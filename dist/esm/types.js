export class LicenseTouchError extends Error {
    status;
    body;
    code;
    constructor(params) {
        super(params.message);
        this.name = 'LicenseTouchError';
        this.code = params.code;
        this.status = params.status;
        this.body = params.body;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
