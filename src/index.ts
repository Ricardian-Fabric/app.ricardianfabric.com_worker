export interface Env {
  LINKS: KVNamespace;
}

export enum Paths {
  main,
  dep,
  contract,
}

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
    },
  };

  if (path === Paths.contract) {
    const data = await fetchGraphql(arweaveTx);

    if (data.transaction === null) {
      return notFound(init);
    }

    const acceptableContract = isAcceptableContract(data.transaction);

    if (acceptableContract) {
      return await fetchText(urlToFetch, init);
    } else {
      return notFound(init);
    }
  } else {
    return await fetchText(urlToFetch, init);
  }
}

async function notFound(init: any): Promise<Response> {
  return new Response(
    "Not Found, If You just uploaded a contract wait a few minutes for the transaction to be mined!",
    { ...init, status: 404 }
  );
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
    const requestUrl = new URL(request.url);
    const [currentPath, link, arweaveTx] = await parsePaths(requestUrl, env);
    return fetchRouter(currentPath, link, arweaveTx);
  },
};
