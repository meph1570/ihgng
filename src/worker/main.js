onmessage = function(e) {
    let [funcStr, html, currentUrl, callId] = e.data;

    if (navigator.geolocation) {
        throw new Error("Sandbox Error: navigator.geolocation is available");
    }

    try {
        let func = eval(funcStr);
        let parseResult = func(html, currentUrl);
        postMessage([callId, parseResult]);
    }
    catch (e) {
        e.callId = callId;
        throw e;
    }
};