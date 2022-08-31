export interface Env {
  LINKS: KVNamespace;
}

export enum Paths {
  main,
  dep,
  contract,
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const notFoundHTML = (link: string) => `
<html>
  <head>
    <title>Not Found</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
      background: radial-gradient(lightgrey 3px, transparent 4px),
        radial-gradient(lightgrey 3px, transparent 4px),
        linear-gradient(#fff 4px, transparent 0),
        linear-gradient(
          45deg,
          transparent 74px,
          transparent 75px,
          #a4a4a4 75px,
          #a4a4a4 76px,
          transparent 77px,
          transparent 109px
        ),
        linear-gradient(
          -45deg,
          transparent 75px,
          transparent 76px,
          #a4a4a4 76px,
          #a4a4a4 77px,
          transparent 78px,
          transparent 109px
        ),
        #fff;
      background-size: 109px 109px, 109px 109px, 100% 6px, 109px 109px,
        109px 109px;
      background-position: 54px 55px, 0px 0px, 0px 0px, 0px 0px, 0px 0px;
      font-family: Sans-Serif;
    }

    a{
      cursor: pointer;
      background-color: black;
      border-radius: 20px;
      padding: 5px;
      color: white !important;
      border: none;
      width: 200px;
      margin: 0 auto;
      text-decoration: none;
    
    }
        .box{
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 60%;
        }
        .container{
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }
      </style>
  <body>
    <div class="box"> 
      <div class="container">
   	  <h2>Not Found</h2>
      <p>If you just created a Ricardian Contract, you need to wait for the transaction to be mined before it shows up here.</p>
      <a href="${link}">See it on Arweave.net</a>
      </div>
</div>
  </html>
</html>`;

async function fetchGraphql(txId: string) {
  const results = await fetch("https://arweave.net/graphql", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      query: `{transaction(id: \"${txId}\"){
      tags{
        name
        value
      }
    }}`,
    }),
  });
  const transactions: { data: any } = await results.json();

  return transactions.data;
}

async function fetchRouter(path: Paths, urlToFetch: string, arweaveTx: string) {
  function getContentType(paths: Paths): string {
    if (paths === Paths.dep) {
      return "application/javascript;charset=UTF-8";
    } else {
      return "text/html;charset=UTF-8";
    }
  }
  const init = {
    headers: {
      "content-type": getContentType(path),
      ...corsHeaders,
    },
  };

  if (path === Paths.contract) {
    const data = await fetchGraphql(arweaveTx);

    if (data.transaction === null) {
      return notFound(init, arweaveTx);
    }

    const acceptableContract = isAcceptableContract(data.transaction);

    if (acceptableContract) {
      return await fetchText(urlToFetch, init);
    } else {
      return notFound(init, arweaveTx);
    }
  } else {
    return await fetchText(urlToFetch, init);
  }
}

async function notFound(init: any, txId: string): Promise<Response> {
  return new Response(notFoundHTML(`https://arweave.net/${txId}`), {
    ...init,
    status: 404,
  });
}

async function fetchText(urlToFetch: string, init: any): Promise<Response> {
  const fetchResponse = await fetch(urlToFetch, init);
  const fetchedText = await fetchResponse.text();
  const newResponse = new Response(fetchedText, init);
  return newResponse;
}

function isAcceptableContract(transaction: any): boolean {
  if (transaction === null) {
    return false;
  }

  const found = {
    appname: false,
    contractType: false,
    issuer: false,
    version: false,
    contentType: false,
    network: false,
  };

  const tags = transaction.tags;

  for (let i = 0; i < tags.length; i++) {
    let tag = tags[i];
    if (tag.name === "Issuer") {
      found.issuer = true;
    }
    if (tag.name === "Network") {
      found.network = true;
    }
    if (tag.name === "Contract-Type" && tag.value === "Acceptable") {
      found.contractType = true;
    }
    if (tag.name === "App-Name" && tag.value === "Ricardian Fabric") {
      found.appname = true;
    }
    if (tag.name === "App-Version") {
      found.version = true;
    }
    if (tag.name === "Content-Type") {
      found.contentType = true;
    }
  }

  return (
    found.appname &&
    found.contentType &&
    found.issuer &&
    found.version &&
    found.contentType &&
    found.network &&
    !found.contentType === false
  );
}

async function parsePaths(
  url: URL,
  env: Env
): Promise<[Paths, string, string]> {
  if (url.pathname === "/") {
    const main = (await env.LINKS.get("main")) as string;
    return [Paths.main, main, ""];
  } else if (url.pathname === "/deps") {
    const dep = (await env.LINKS.get("dependency")) as string;
    return [Paths.dep, dep, ""];
  } else if (url.pathname.includes("/contract/")) {
    const arweaveId = url.pathname.split("/contract/", 2)[1];
    const arweaveUrl = "https://arweave.net/" + arweaveId;
    return [Paths.contract, arweaveUrl, arweaveId];
  }
  const main = (await env.LINKS.get("main")) as string;
  return [Paths.main, main, ""];
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    //Handle cors prefligh request

    if (request.method === `OPTIONS`) {
      return new Response(null, { headers: { ...corsHeaders } });
    } else {
      const requestUrl = new URL(request.url);
      const [currentPath, link, arweaveTx] = await parsePaths(requestUrl, env);
      return fetchRouter(currentPath, link, arweaveTx);
    }
  },
};
