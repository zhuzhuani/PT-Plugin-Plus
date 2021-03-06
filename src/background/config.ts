import {
  Options,
  ESizeUnit,
  EConfigKey,
  Site,
  DownloadClient,
  UIOptions
} from "../interface/common";
import { API, APP } from "../service/api";
import localStorage from "../service/localStorage";

/**
 * 配置信息类
 */
class Config {
  private name: string = EConfigKey.default;
  private localStorage: localStorage = new localStorage();

  public schemas: any[] = [];
  public sites: any[] = [];
  public clients: any[] = [];

  constructor() {
    this.getSchemas();
    this.getSites();
    this.getClients();
  }

  /**
   * 系统参数
   */
  public options: Options = {
    exceedSizeUnit: ESizeUnit.GiB,
    sites: [],
    clients: [],
    system: {},
    allowDropToSend: true,
    allowSelectionTextSearch: true,
    needConfirmWhenExceedSize: true,
    exceedSize: 10,
    search: {
      rows: 10,
      // 搜索超时
      timeout: 30000
    },
    // 连接下载服务器超时时间（毫秒）
    connectClientTimeout: 5000,
    rowsPerPageItems: [
      10,
      20,
      50,
      100,
      200,
      { text: "$vuetify.dataIterator.rowsPerPageAll", value: -1 }
    ]
  };

  public uiOptions: UIOptions = {};

  /**
   * 保存配置
   * @param options 配置信息
   */
  public save(options?: Options) {
    this.localStorage.set(this.name, options || this.options);
  }

  /**
   * 读取配置信息
   * @return Promise 配置信息
   */
  public read(): Promise<any> {
    return new Promise<any>((resolve?: any, reject?: any) => {
      // 加载用户界面设置
      this.localStorage.get(EConfigKey.uiOptions, (result: any) => {
        if (result) {
          let defaultOptions = Object.assign({}, this.uiOptions);
          this.uiOptions = Object.assign(defaultOptions, result);
        }
      });

      this.localStorage.get(this.name, (result: any) => {
        if (result) {
          delete result.system;
          let defaultOptions = Object.assign({}, this.options);
          this.options = Object.assign(defaultOptions, result);
        }
        // 覆盖站点架构
        this.options.system = {
          schemas: this.schemas,
          sites: this.sites,
          clients: this.clients
        };

        // 升级不存在的配置项
        this.sites.forEach(item => {
          let index = this.options.sites.findIndex((site: Site) => {
            return site.host === item.host;
          });

          if (index > -1) {
            this.options.sites[index] = Object.assign(
              Object.assign({}, item),
              this.options.sites[index]
            );
          }
        });

        // 升级不存在的配置项
        this.clients.forEach(item => {
          let index = this.options.clients.findIndex(
            (client: DownloadClient) => {
              return client.type === item.type;
            }
          );

          if (index > -1) {
            this.options.clients[index] = Object.assign(
              Object.assign({}, item),
              this.options.clients[index]
            );
          }
        });

        console.log(this.options);

        resolve(this.options);
      });
    });
  }

  public readUIOptions(): Promise<any> {
    return new Promise<any>((resolve?: any, reject?: any) => {
      // 加载用户界面设置
      this.localStorage.get(EConfigKey.uiOptions, (result: any) => {
        if (result) {
          let defaultOptions = Object.assign({}, this.uiOptions);
          this.uiOptions = Object.assign(defaultOptions, result);
        }

        resolve(this.uiOptions);
      });
    });
  }

  public saveUIOptions(options: UIOptions): Promise<any> {
    return new Promise<any>((resolve?: any, reject?: any) => {
      this.localStorage.set(EConfigKey.uiOptions, options || this.uiOptions);
      resolve();
    });
  }

  /**
   * 获取支持的网站架构
   */
  public getSchemas(): any {
    this.getContentFromApi(`${API.schemas}`).then((result: any) => {
      if (result.length) {
        result.forEach((item: any) => {
          if (item.type === "dir") {
            this.addSchema(
              API.schemaConfig.replace(/\{\$schema\}/g, item.name)
            );
          }
        });
      }
    });
  }

  public addSchema(path: string): void {
    this.getContentFromApi(path).then((result: any) => {
      if (result && result.name) {
        this.schemas.push(result);
      }
    });
  }

  public getSites() {
    this.getContentFromApi(API.sites).then((result: any) => {
      if (result.length) {
        result.forEach((item: any) => {
          if (item.type === "dir") {
            // this.schemas.push(item.name);
            this.addSite(API.siteConfig.replace(/\{\$site\}/g, item.name));
          }
        });
      }
    });
  }

  public addSite(path: string): void {
    this.getContentFromApi(path).then((result: any) => {
      if (result && result.name) {
        this.sites.push(result);
      }
    });
  }

  public getClients() {
    this.clients = [];
    this.getContentFromApi(API.clients).then((result: any) => {
      if (result.length) {
        result.forEach((item: any) => {
          if (item.type === "dir") {
            this.addClient(
              API.clientConfig.replace(/\{\$client\}/g, item.name)
            );
          }
        });
      }
    });
  }

  public addClient(path: string): void {
    this.getContentFromApi(path).then((result: any) => {
      if (result && result.name) {
        this.clients.push(result);
      }
    });
  }

  public getContentFromApi(api: string): Promise<any> {
    return new Promise<any>((resolve?: any, reject?: any) => {
      let content = APP.cache.get(api);
      if (content) {
        resolve(content);
        return;
      }
      $.getJSON(api).then(result => {
        APP.cache.set(api, result);
        resolve(result);
      });
    });
  }
}
export default Config;
