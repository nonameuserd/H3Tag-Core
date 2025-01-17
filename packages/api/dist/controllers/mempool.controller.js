"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MempoolController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const mempool_dto_1 = require("../dtos/mempool.dto");
const shared_1 = require("@h3tag-blockchain/shared");
let MempoolController = class MempoolController {
    constructor(mempoolService) {
        this.mempoolService = mempoolService;
    }
    async getMempoolInfo() {
        try {
            return await this.mempoolService.getMempoolInfo();
        }
        catch (error) {
            shared_1.Logger.error('Failed to get mempool info:', error);
            throw new common_1.HttpException(`Failed to get mempool info: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getRawMempool(verbose = false) {
        try {
            return await this.mempoolService.getRawMempool(verbose);
        }
        catch (error) {
            shared_1.Logger.error('Failed to get raw mempool:', error);
            throw new common_1.HttpException(`Failed to get raw mempool: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getMempoolEntry(txid) {
        try {
            return await this.mempoolService.getMempoolEntry(txid);
        }
        catch (error) {
            shared_1.Logger.error('Failed to get mempool entry:', error);
            throw new common_1.HttpException(error.message, error.message.includes('not found') ? common_1.HttpStatus.NOT_FOUND : common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.MempoolController = MempoolController;
__decorate([
    (0, common_1.Get)('info'),
    (0, swagger_1.ApiOperation)({ summary: 'Get mempool information' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Mempool information retrieved successfully',
        type: mempool_dto_1.MempoolInfoDto
    })
], MempoolController.prototype, "getMempoolInfo", null);
__decorate([
    (0, common_1.Get)('raw'),
    (0, swagger_1.ApiOperation)({ summary: 'Get raw mempool transactions' }),
    (0, swagger_1.ApiQuery)({ name: 'verbose', type: Boolean, required: false }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Raw mempool transactions retrieved successfully',
        type: mempool_dto_1.RawMempoolEntryDto
    }),
    __param(0, (0, common_1.Query)('verbose'))
], MempoolController.prototype, "getRawMempool", null);
__decorate([
    (0, common_1.Get)('entry/:txid'),
    (0, swagger_1.ApiOperation)({ summary: 'Get specific mempool entry' }),
    (0, swagger_1.ApiParam)({ name: 'txid', description: 'Transaction ID to lookup' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Mempool entry retrieved successfully',
        type: mempool_dto_1.MempoolEntryDto
    }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Transaction not found in mempool'
    }),
    __param(0, (0, common_1.Param)('txid'))
], MempoolController.prototype, "getMempoolEntry", null);
exports.MempoolController = MempoolController = __decorate([
    (0, swagger_1.ApiTags)('Mempool'),
    (0, common_1.Controller)('mempool')
], MempoolController);
//# sourceMappingURL=mempool.controller.js.map