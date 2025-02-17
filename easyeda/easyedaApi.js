// easyeda_api.js

// If using Node 18+ you can use the built-in fetch. Otherwise, install and require node-fetch:
// const fetch = require('node-fetch');
const fetch = global.fetch || require("node-fetch");

// Import version from your package or module (adjust the path as needed)
const __version__ = '1.0.0';

const API_ENDPOINT = "https://easyeda.com/api/products/{lcsc_id}/components?version=6.4.19.5";
const ENDPOINT_3D_MODEL = "https://modules.easyeda.com/3dmodel/{uuid}";
const ENDPOINT_3D_MODEL_STEP = "https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/{uuid}";
// ENDPOINT_3D_MODEL_STEP is based on information from the SMT engine.

class EasyedaApi {
    constructor() {
        this.headers = {
            "Accept-Encoding": "gzip, deflate",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": `easyeda2kicad v${__version__}`,
        };
    }

    async getInfoFromEasyedaApi(lcsc_id) {
        const url = API_ENDPOINT.replace("{lcsc_id}", lcsc_id);
        const response = await fetch(url, { headers: this.headers });
        const apiResponse = await response.json();
        if (
            !apiResponse ||
            (("code" in apiResponse) && apiResponse.success === false)
        ) {
            console.debug(apiResponse);
            return {};
        }
        return apiResponse;
    }

    async getCadDataOfComponent(lcsc_id) {
        const cpCadInfo = await this.getInfoFromEasyedaApi(lcsc_id);
        if (Object.keys(cpCadInfo).length === 0) {
            return {};
        }
        return cpCadInfo["result"];
    }

    async getRaw3dModelObj(uuid) {
        const url = ENDPOINT_3D_MODEL.replace("{uuid}", uuid);
        const response = await fetch(url, {
            headers: { "User-Agent": this.headers["User-Agent"] },
        });
        if (!response.ok) {
            console.error(`No raw 3D model data found for uuid:${uuid} on easyeda`);
            return null;
        }
        return await response.text();
    }

    async getStep3dModel(uuid) {
        const url = ENDPOINT_3D_MODEL_STEP.replace("{uuid}", uuid);
        const response = await fetch(url, {
            headers: { "User-Agent": this.headers["User-Agent"] },
        });
        if (!response.ok) {
            console.error(`No step 3D model data found for uuid:${uuid} on easyeda`);
            return null;
        }
        // Return as an ArrayBuffer; you can convert it to a Buffer if needed.
        return await response.arrayBuffer();
    }
}

module.exports = { EasyedaApi };