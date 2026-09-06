"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseTouchError = void 0;
class LicenseTouchError extends Error {
    status;
    body;
    code;
    constructor(params) {
        super(params.message);
        this.name = 'LicenseTouchError';
        this.code = params.code;
        this.status = params.status;
        this.body = params.body;
    }
}
exports.LicenseTouchError = LicenseTouchError;
