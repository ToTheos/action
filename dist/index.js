"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFile = downloadFile;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
const os_1 = __importDefault(require("os"));
async function downloadFile(url, outputDir = '.') {
    const fileName = path_1.default.basename(new URL(url).pathname);
    const outputPath = path_1.default.join(outputDir, fileName);
    const tmpPath = outputPath + '.tmp';
    await fs.promises.mkdir(outputDir, { recursive: true });
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok || !res.body) {
        throw new Error(`Failed to download file: ${res.status} ${res.statusText}`);
    }
    const nodeStream = stream_1.Readable.from(res.body);
    const fileStream = fs.createWriteStream(tmpPath);
    nodeStream.pipe(fileStream);
    // Wait until fully written + closed
    await (0, promises_1.finished)(fileStream);
    // Ensure executable permissions BEFORE rename (optional but clean)
    fs.chmodSync(tmpPath, 0o755);
    // Atomic replace
    fs.renameSync(tmpPath, outputPath);
    return outputPath;
}
async function spawnWithRetry(filePath, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const child = (0, child_process_1.spawn)(filePath, [], { stdio: 'inherit' });
            return child;
        }
        catch (err) {
            if (err.code === 'ETXTBSY') {
                await new Promise((r) => setTimeout(r, 100));
                continue;
            }
            throw err;
        }
    }
    throw new Error(`Failed to spawn ${filePath} after ${retries} retries`);
}
function getBinaryName() {
    switch (os_1.default.arch()) {
        case 'x64':
            return 'totheos-linux-x64';
        case 'arm64':
            return 'totheos-linux-arm64';
        default:
            throw new Error(`Unsupported architecture: ${os_1.default.arch()}`);
    }
}
async function run() {
    const url = `https://github.com/totheos/action/releases/latest/download/${getBinaryName()}`;
    const filePath = await downloadFile(url, '/tmp');
    // Small delay (extra safety for CI environments)
    await new Promise((r) => setTimeout(r, 50));
    const child = await spawnWithRetry(filePath);
    child.on('exit', (code) => {
        process.exit(code !== null && code !== void 0 ? code : 1);
    });
    child.on('error', (err) => {
        console.error('Failed to start process:', err);
        process.exit(1);
    });
}
run();
