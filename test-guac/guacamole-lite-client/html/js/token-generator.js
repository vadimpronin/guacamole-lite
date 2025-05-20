async function generateGuacamoleToken(tokenObj) {
  /* ------------ demo-only token generation (do this in backend IRL) --- */
  const CIPHER = 'AES-256-CBC';
  const KEY = new TextEncoder().encode('MySuperSecretKeyForParamsToken12');

  const iv   = crypto.getRandomValues(new Uint8Array(16));
  const algo = { name: "AES-CBC", iv };
  const key  = await crypto.subtle.importKey("raw", KEY, algo, false, ["encrypt"]);
  const ct   = new Uint8Array(await crypto.subtle.encrypt(algo, key,
                      new TextEncoder().encode(JSON.stringify(tokenObj))));

  const token = btoa(JSON.stringify({
    iv:    btoa(String.fromCharCode(...iv)),
    value: btoa(String.fromCharCode(...ct))
  }));

  return token;
} 
