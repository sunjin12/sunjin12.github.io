export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const params = new URLSearchParams({
        client_id: env.CLIENT_ID,
        redirect_uri: `${url.origin}/callback`,
        scope: "repo,user",
      });
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://github.com/login/oauth/authorize?${params}`,
        },
      });
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");

      if (!code) {
        return new Response("Missing code parameter", { status: 400 });
      }

      // GitHub에 code를 보내 access_token 교환
      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: env.CLIENT_ID,
            client_secret: env.CLIENT_SECRET,
            code,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(
          '<!DOCTYPE html><html><body><script>' +
            'window.opener.postMessage("authorization:github:error:OAuth error","*");' +
            '</script></body></html>',
          { headers: { "Content-Type": "text/html" } }
        );
      }

      const token = tokenData.access_token;
      const content = JSON.stringify({ token, provider: "github" });

      return new Response(
        `<!DOCTYPE html><html><body><script>
          (function() {
            var content = ${JSON.stringify(content)};
            function receiveMessage(e) {
              window.opener.postMessage(
                "authorization:github:success:" + content,
                e.origin
              );
              window.removeEventListener("message", receiveMessage);
            }
            window.addEventListener("message", receiveMessage, false);
            window.opener.postMessage("authorizing:github", "*");
          })();
        </script></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
