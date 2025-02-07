const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

const API_URL = 'https://api.ipify.org/?format=json';
const FILE_DIR = 'proxy_files';
const OUTPUT_ALL_FILE = `all_output.txt`;

// Функция для проверки и создания папки и файлов
function ensureFileExists(filename) {
    const filePath = path.join(FILE_DIR, filename);
    if (!fs.existsSync(FILE_DIR)) {
        fs.mkdirSync(FILE_DIR, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', 'utf8');
    }
    return filePath;
}

// Функция для очистки файлов перед запуском
function clearFile(filename) {
    const filePath = path.join(FILE_DIR, filename);
    fs.writeFileSync(filePath, '', 'utf8');
}

// Функция для чтения списка прокси из файла
function readProxiesFromFile(filename) {
    const filePath = ensureFileExists(filename);
    return fs.readFileSync(filePath, 'utf8').split('\n').map(line => line.trim()).filter(line => line);
}

// Функция для записи результатов в файл
function writeResultToFile(filename, result) {
    const filePath = ensureFileExists(filename);
    fs.appendFileSync(filePath, result + '\n', 'utf8');
}

// Функция проверки прокси
async function checkProxy(proxy, isSocks5 = false) {
    const [ip, port, login, password] = proxy.split(':');
    const proxyUrl = isSocks5 ? `socks5://${login}:${password}@${ip}:${port}` : `http://${login}:${password}@${ip}:${port}`;
    const agent = isSocks5 ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);
    
    try {
        const response = await axios.get(API_URL, { httpsAgent: agent, timeout: 5000 });
        const result = `${proxy}\tOK\t${response.data.ip}`;
        console.log(result);
        return result;
    } catch (err) {
        const result = `${proxy}\tERROR\t${err.message}`;
        console.error(result);
        return result;
    }
}

// Основная функция для обработки прокси из файлов параллельно
async function processProxies({ inputFile, outputOkFile, outputErrorFile, isSocks5 = false }) {
    const proxies = readProxiesFromFile(inputFile);
    const promises = proxies.map(async (proxy) => {
        let result = await checkProxy(proxy, isSocks5);
        if (result.includes('OK')) {
            writeResultToFile(outputOkFile, result);
        } else {
            writeResultToFile(outputErrorFile, result);
        }
        const proxyType = (isSocks5) ? "SOCKS5" : "HTTPS";
        result = result.replaceAll(proxy, proxy + `\t${(proxyType)}`)
        writeResultToFile(OUTPUT_ALL_FILE, result);
    });
    await Promise.all(promises);
}

(async () => {
    // Очистка файлов перед началом работы
    clearFile('socks5_output_ok.txt');
    clearFile('socks5_output_error.txt');
    clearFile('http_output_ok.txt');
    clearFile('http_output_error.txt');
    clearFile(OUTPUT_ALL_FILE)
    
    await Promise.all([
        processProxies({ inputFile: 'socks5_input.txt', outputOkFile: 'socks5_output_ok.txt', outputErrorFile: 'socks5_output_error.txt', isSocks5: true }),
        processProxies({ inputFile: 'http_input.txt', outputOkFile: 'http_output_ok.txt', outputErrorFile: 'http_output_error.txt', isSocks5: false })
    ]);
})();
