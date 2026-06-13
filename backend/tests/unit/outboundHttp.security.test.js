const path = require('path');
const dns = require('dns');
const rewire = require('rewire');
const {
    assertPublicHttpsUrl,
    createPublicHttpsAgent,
    isPrivateIp
} = require('../../src/services/utils/outboundUrlPolicy');

const modulePath = (relativePath) => path.join(__dirname, '../../src', relativePath);

describe('outbound HTTP security controls', () => {
    const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('syncs time over HTTPS and refuses redirects', async () => {
        const marketTime = rewire(modulePath('services/utils/marketTime'));
        const axios = {
            get: jest.fn().mockResolvedValue({
                data: { utc_datetime: new Date().toISOString() }
            })
        };

        marketTime.__set__('axios', axios);
        marketTime.__set__('logger', mockLogger);

        const fetchTimeOffset = marketTime.__get__('fetchTimeOffset');
        await expect(fetchTimeOffset(true)).resolves.toBe(true);

        expect(axios.get).toHaveBeenCalledWith(
            'https://worldtimeapi.org/api/timezone/Asia/Kathmandu',
            { timeout: 5000, maxRedirects: 0 }
        );
    });

    it('sends alert webhooks without following redirects', async () => {
        const alertService = rewire(modulePath('services/utils/alertService'));
        const axios = { post: jest.fn().mockResolvedValue({ status: 204 }) };

        alertService.__set__('axios', axios);
        alertService.__set__('logger', mockLogger);
        alertService.__set__('WEBHOOK_URL', 'https://hooks.slack.com/services/T/B/C');
        alertService.__set__('ALERT_ENABLED', true);

        await expect(alertService.sendAlert('test alert', 'info')).resolves.toBe(true);

        expect(axios.post).toHaveBeenCalledWith(
            'https://hooks.slack.com/services/T/B/C',
            expect.any(Object),
            expect.objectContaining({
                timeout: 5000,
                maxRedirects: 0,
                httpsAgent: expect.any(Object)
            })
        );
    });

    it('blocks alert webhook requests to private network destinations', async () => {
        const alertService = rewire(modulePath('services/utils/alertService'));
        const axios = { post: jest.fn().mockResolvedValue({ status: 204 }) };

        alertService.__set__('axios', axios);
        alertService.__set__('logger', mockLogger);
        alertService.__set__('WEBHOOK_URL', 'https://169.254.169.254/latest/meta-data');
        alertService.__set__('ALERT_ENABLED', true);

        await expect(alertService.sendAlert('test alert', 'info')).resolves.toBe(false);

        expect(axios.post).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('private or reserved IP ranges'));
    });

    it('configures proxy API clients to reject redirects', async () => {
        const apiFetchers = rewire(modulePath('services/scrapers/apiFetchers'));
        const client = {
            get: jest.fn().mockResolvedValue({ data: [] })
        };
        const axios = { create: jest.fn().mockReturnValue(client) };

        apiFetchers.__set__('axios', axios);
        apiFetchers.__set__('logger', mockLogger);

        apiFetchers.createClient('https://example.test');
        await expect(apiFetchers.fetchFromNepAlpha()).resolves.toMatchObject({
            stocks: [],
            source: 'nepalpha'
        });

        expect(axios.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
            baseURL: 'https://example.test',
            maxRedirects: 0
        }));
        expect(axios.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
            maxRedirects: 0
        }));
    });

    it('configures AI provider clients to reject redirects', () => {
        const deepseekProvider = rewire(modulePath('services/ai/deepseekProvider'));
        const axios = { create: jest.fn().mockReturnValue({ post: jest.fn() }) };

        deepseekProvider.__set__('axios', axios);

        deepseekProvider.createDeepSeekProvider({
            apiKey: 'test-key',
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-chat',
            prices: {},
            maxStockOutputTokens: 100,
            maxMarketOutputTokens: 100
        });

        expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
            baseURL: 'https://api.deepseek.com',
            timeout: 30000,
            maxRedirects: 0,
            httpsAgent: expect.any(Object)
        }));
    });

    it('blocks AI provider base URLs that target local services', () => {
        const deepseekProvider = rewire(modulePath('services/ai/deepseekProvider'));
        const axios = { create: jest.fn().mockReturnValue({ post: jest.fn() }) };

        deepseekProvider.__set__('axios', axios);

        expect(() => deepseekProvider.createDeepSeekProvider({
            apiKey: 'test-key',
            baseUrl: 'https://localhost:11434',
            model: 'deepseek-chat',
            prices: {},
            maxStockOutputTokens: 100,
            maxMarketOutputTokens: 100
        })).toThrow('local hostnames');

        expect(axios.create).not.toHaveBeenCalled();
    });

    it('rejects unsafe outbound URL shapes and private IPs', () => {
        expect(() => assertPublicHttpsUrl('http://hooks.slack.com/services/T/B/C')).toThrow('must use https');
        expect(() => assertPublicHttpsUrl('https://user:pass@example.com/hook')).toThrow('must not include credentials');
        expect(() => assertPublicHttpsUrl('https://127.0.0.1/hook')).toThrow('private or reserved IP ranges');
        expect(() => assertPublicHttpsUrl('https://198.51.100.10/hook')).toThrow('private or reserved IP ranges');
        expect(() => assertPublicHttpsUrl('https://203.0.113.10/hook')).toThrow('private or reserved IP ranges');
        expect(() => assertPublicHttpsUrl('https://[::ffff:7f00:1]/hook')).toThrow('private or reserved IP ranges');
        expect(isPrivateIp('10.0.0.5')).toBe(true);
        expect(isPrivateIp('::1')).toBe(true);
        expect(isPrivateIp('::ffff:7f00:1')).toBe(true);
        expect(isPrivateIp('::ffff:0a00:1')).toBe(true);
        expect(isPrivateIp('::ffff:c0a8:1')).toBe(true);
        expect(isPrivateIp('::7f00:1')).toBe(true);
        expect(isPrivateIp('198.51.100.10')).toBe(true);
        expect(isPrivateIp('203.0.113.10')).toBe(true);
        expect(isPrivateIp('64:ff9b::7f00:1')).toBe(true);
        expect(isPrivateIp('64:ff9b:1::8888')).toBe(true);
        expect(isPrivateIp('2001:db8::1')).toBe(true);
        expect(isPrivateIp('2002:0808:0808::1')).toBe(true);
        expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
        expect(isPrivateIp('8.8.8.8')).toBe(false);
    });

    it('blocks outbound hostnames that resolve to private IPs', async () => {
        const lookupSpy = jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
            callback(null, [{ address: '10.0.0.10', family: 4 }]);
        });

        const agent = createPublicHttpsAgent('https://example.test/hook', { label: 'TEST_URL' });

        await expect(new Promise((resolve, reject) => {
            agent.options.lookup('example.test', {}, (error) => {
                if (error) reject(error);
                resolve();
            });
        })).rejects.toThrow('resolved to a private or reserved IP range');

        lookupSpy.mockRestore();
    });

    it('blocks outbound hostnames that resolve to IPv4-mapped private IPv6 forms', async () => {
        const lookupSpy = jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
            callback(null, [{ address: '::ffff:7f00:1', family: 6 }]);
        });

        const agent = createPublicHttpsAgent('https://example.test/hook', { label: 'TEST_URL' });

        await expect(new Promise((resolve, reject) => {
            agent.options.lookup('example.test', {}, (error) => {
                if (error) reject(error);
                resolve();
            });
        })).rejects.toThrow('resolved to a private or reserved IP range');

        lookupSpy.mockRestore();
    });

    it('blocks outbound hostnames that resolve to reserved IPv4 documentation ranges', async () => {
        const lookupSpy = jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
            callback(null, [{ address: '203.0.113.10', family: 4 }]);
        });

        const agent = createPublicHttpsAgent('https://example.test/hook', { label: 'TEST_URL' });

        await expect(new Promise((resolve, reject) => {
            agent.options.lookup('example.test', {}, (error) => {
                if (error) reject(error);
                resolve();
            });
        })).rejects.toThrow('resolved to a private or reserved IP range');

        lookupSpy.mockRestore();
    });

    it('blocks outbound hostnames that resolve to IPv6 transition addresses for reserved targets', async () => {
        const lookupSpy = jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
            callback(null, [{ address: '64:ff9b::7f00:1', family: 6 }]);
        });

        const agent = createPublicHttpsAgent('https://example.test/hook', { label: 'TEST_URL' });

        await expect(new Promise((resolve, reject) => {
            agent.options.lookup('example.test', {}, (error) => {
                if (error) reject(error);
                resolve();
            });
        })).rejects.toThrow('resolved to a private or reserved IP range');

        lookupSpy.mockRestore();
    });

    it('passes redirect refusal to market depth helper requests', async () => {
        const depthFetcher = rewire(modulePath('services/depthFetcher'));
        const nepseAxios = {
            get: jest.fn()
                .mockResolvedValueOnce({ data: [{ symbol: 'NABIL', id: 1 }] })
                .mockResolvedValueOnce({ data: { buyMarketDepthList: [], sellMarketDepthList: [] } })
                .mockResolvedValueOnce({ data: [] })
        };
        const ctx = {
            BASE_URL: 'https://nepalstock.com.np',
            headers: { Authorization: 'Bearer test' },
            nepseAxios
        };

        const lookupCompanyId = depthFetcher.__get__('lookupCompanyId');
        const fetchAndTransformDepth = depthFetcher.__get__('fetchAndTransformDepth');
        const fetchAndTransformFloorsheet = depthFetcher.__get__('fetchAndTransformFloorsheet');

        await expect(lookupCompanyId(ctx, 'NABIL')).resolves.toBe(1);
        await expect(fetchAndTransformDepth(ctx, 1, 'NABIL')).resolves.toEqual({ buy: [], sell: [] });
        await expect(fetchAndTransformFloorsheet(ctx, 1, 'NABIL')).resolves.toEqual([]);

        expect(nepseAxios.get).toHaveBeenCalledWith(
            'https://nepalstock.com.np/api/nots/company/list',
            expect.objectContaining({ timeout: 5000, maxRedirects: 0 })
        );
        expect(nepseAxios.get).toHaveBeenCalledWith(
            'https://nepalstock.com.np/api/nots/nepse-data/marketdepth/1',
            expect.objectContaining({ timeout: 5000, maxRedirects: 0 })
        );
        expect(nepseAxios.get).toHaveBeenCalledWith(
            'https://nepalstock.com.np/api/nots/floorsheet?companyId=1',
            expect.objectContaining({ timeout: 5000, maxRedirects: 0 })
        );
    });

    it('keeps the disabled ShareSansar watchdog provider safe and non-throwing', async () => {
        jest.doMock('../../src/services/utils/logger', () => mockLogger);
        const provider = require('../../src/services/watchdog/providers/ShareSansarProvider');

        await expect(provider.fetchMarketSummary()).resolves.toEqual({
            source: 'ShareSansar',
            success: false,
            error: 'Scraping Deprecated (WAF restrictions)'
        });
    });
});
