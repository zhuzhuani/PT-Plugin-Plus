import {
  Options,
  EAction,
  Site,
  SiteSchema,
  Dictionary,
  DownloadClient,
  EDownloadClientType,
  DownloadOptions,
  DataResult,
  EDataResultType
} from "@/interface/common";
import { filters as Filters } from "@/service/filters";
import { ClientController } from "@/service/clientController";
import { DownloadHistory } from "./downloadHistory";
import { Searcher } from "./searcher";
export default class Controller {
  public options: Options = {
    sites: [],
    clients: []
  };

  public defaultClient: any;
  public defaultClientOptions: DownloadClient = {};
  public siteDefaultClients: any = {};
  public optionsTabId: number | undefined = 0;
  public downloadHistory: DownloadHistory = new DownloadHistory();
  public clients: any = {};
  public searcher: Searcher = new Searcher();

  public clientController: ClientController = new ClientController();
  public isInitialized: boolean = false;

  public init(options: Options) {
    this.reset(options);
    this.isInitialized = true;
  }

  /**
   * 重置并刷新配置
   * @param options
   */
  public reset(options: Options) {
    this.options = options;
    this.clientController.init(options);
    this.searcher.options = options;
    this.initDefaultClient();
  }

  /**
   * 获取搜索结果
   * @param options
   */
  public getSearchResult(options: any): Promise<any> {
    return this.searcher.searchTorrent(options.site, options.key);
    // return new Promise<any>((resolve?: any, reject?: any) => {
    //   let settings = {
    //     url: options.url,
    //     success: (result: any) => {
    //       if (
    //         (result && (typeof result == "string" && result.length > 100)) ||
    //         typeof result == "object"
    //       ) {
    //         console.log(result);

    //         // let script = options.scripts[index];
    //         const results: any[] = [];
    //         if (options.script) {
    //           eval(options.script);
    //         }

    //         resolve(results);
    //       } else {
    //         reject();
    //       }
    //     },
    //     error: (result: any) => {
    //       reject(result);
    //     }
    //   };

    //   $.ajax(settings);
    // });
  }

  /**
   * 获取下载历史记录
   */
  public getDownloadHistory(): Promise<any> {
    return this.downloadHistory.load();
  }

  /**
   * 保存下载记录
   * @param data 下载链接信息
   * @param host 站点域名
   * @param clientId 下载客户端ID
   */
  private saveDownloadHistory(
    data: any,
    host: string = "",
    clientId: string = ""
  ) {
    // 是否保存历史记录
    if (this.options.saveDownloadHistory) {
      this.downloadHistory.add(data, host, clientId);
    }
  }

  /**
   * 删除下载历史记录
   * @param items 需要删除的列表
   */
  public removeDownloadHistory(items: any[]): Promise<any> {
    return this.downloadHistory.remove(items);
  }

  /**
   * 清除下载记录
   */
  public clearDownloadHistory(): Promise<any> {
    return this.downloadHistory.clear();
  }

  /**
   * 发送下载信息到指定的客户端
   * @param data
   */
  public sendTorrentToClient(data: DownloadOptions): Promise<any> {
    return new Promise<any>((resolve?: any, reject?: any) => {
      if (!data.url) {
        reject({
          msg: "无效的地址"
        });
        return;
      }
      let URL = Filters.parseURL(data.url);
      let host = URL.host;
      let clientConfig = this.options.clients.find((item: DownloadClient) => {
        return item.id === data.clientId;
      });
      if (!clientConfig) {
        reject({
          msg: "无效的下载服务器"
        });
        return;
      }

      this.getClient(clientConfig).then((result: any) => {
        this.doDownload(result, data, data.savePath).then((result: any) => {
          this.saveDownloadHistory(data, host, clientConfig.id);
          resolve(result);
        });
      });
    });
  }

  /**
   * 发送下载链接地址到默认服务器（客户端）
   * @param data 链接地址
   */
  public sendTorrentToDefaultClient(data: DownloadOptions): Promise<any> {
    return new Promise<any>((resolve?: any, reject?: any) => {
      let URL = Filters.parseURL(data.url);
      let host = URL.host;
      let site = this.getSiteFromHost(host);
      let siteDefaultPath = this.getSiteDefaultPath(site);
      let siteClientConfig = this.siteDefaultClients[host];
      if (!siteClientConfig) {
        this.initSiteDefaultClient(host).then((siteClientConfig: any) => {
          this.siteDefaultClients[host] = siteClientConfig;

          this.doDownload(siteClientConfig, data, siteDefaultPath).then(
            (result: any) => {
              this.saveDownloadHistory(
                data,
                site.host,
                siteClientConfig.options.id
              );
              resolve(result);
            }
          );
        });
      } else {
        this.doDownload(siteClientConfig, data, siteDefaultPath).then(
          (result: any) => {
            this.saveDownloadHistory(
              data,
              site.host,
              siteClientConfig.options.id
            );
            resolve(result);
          }
        );
      }
    });
  }

  /**
   * 执行下载操作
   * @param clientConfig
   * @param data
   * @param siteDefaultPath
   */
  private doDownload(
    clientConfig: any,
    data: DownloadOptions,
    siteDefaultPath: string = ""
  ): Promise<any> {
    return new Promise((resolve?: any, reject?: any) => {
      clientConfig.client
        .call(EAction.addTorrentFromURL, {
          url: data.url,
          savePath: data.savePath,
          autoStart: data.autoStart
        })
        .then((result: any) => {
          this.formatSendResult(
            result,
            clientConfig.options,
            siteDefaultPath
          ).then((result: any) => {
            resolve(result);
          });
        })
        .catch((result: any) => {
          reject(result);
        });
    });
  }

  /**
   * 根据指定的域名获取站点配置信息
   * @param host 域名
   */
  public getSiteFromHost(host: string): Site {
    return this.options.sites.find((item: Site) => {
      return item.host === host;
    });
  }

  /**
   * 获取当前站点的默认下载目录
   * @param string clientId 指定客户端ID，不指定表示使用默认下载客户端
   * @return string 目录信息，如果没有定义，则返回空字符串
   */
  public getSiteDefaultPath(site: Site, clientId: string = ""): string {
    if (!clientId) {
      clientId = site.defaultClientId || <string>this.options.defaultClientId;
    }

    let client = this.options.clients.find((item: any) => {
      return item.id === clientId;
    });
    let path = "";
    if (client && client.paths) {
      for (const host in client.paths) {
        if (site.host === host) {
          path = client.paths[host][0];
          break;
        }
      }
    }

    return path;
  }

  /**
   * 格式化发送结果
   * @param data
   * @param clientOptions
   * @param siteDefaultPath
   */
  private formatSendResult(
    data: any,
    clientOptions: any,
    siteDefaultPath: string
  ): Promise<any> {
    return new Promise((resolve?: any, reject?: any) => {
      let result: DataResult = {
        type: EDataResultType.success,
        msg: "种子已添加",
        success: true,
        data: data
      };

      switch (clientOptions.type) {
        // transmission
        case EDownloadClientType.transmission:
          if (data.id != undefined) {
            result.msg = data.name + " 已发送至 Transmission，编号：" + data.id;
            if (!siteDefaultPath) {
              result.type = EDataResultType.info;
              result.msg += "；但站点默认目录未配置，建议配置。";
            }
          } else if (data.status) {
            switch (data.status) {
              // 重复的种子
              case "duplicate":
                result.type = EDataResultType.error;
                result.success = false;
                result.msg =
                  data.torrent.name + " 种子已存在！编号：" + data.torrent.id;
                break;

              case "error":
                result.type = EDataResultType.error;
                result.success = false;
                result.msg = "链接发送失败，请检查下载服务器是否可用。";
                break;
              default:
                result.msg = data.msg;
                break;
            }
          } else {
            result.msg = data;
          }

          break;

        default:
          break;
      }

      resolve(result);
    });
  }

  /**
   * 根据指定客户端配置初始化客户端
   * @param clientOptions 客户端配置
   */
  private getClient(clientOptions: any): Promise<any> {
    return this.clientController.getClient(clientOptions);
  }

  /**
   * 初始化默认客户端
   */
  private initDefaultClient() {
    if (!this.options.clients) {
      return;
    }
    let clientOptions: any = this.options.clients.find((item: any) => {
      return item.id === this.options.defaultClientId;
    });

    if (clientOptions) {
      this.getClient(clientOptions).then((result: any) => {
        this.defaultClient = result.client;
        this.defaultClientOptions = result.options;
      });
    }
  }

  /**
   * 初始化指定站点默认客户端
   * @param hostname 站点host名称
   */
  private initSiteDefaultClient(hostname: string): Promise<any> {
    let site: any = this.options.sites.find((item: any) => {
      return item.host == hostname;
    });

    let clientOptions: any = this.options.clients.find((item: any) => {
      return item.id === site.defaultClientId;
    });

    if (clientOptions) {
      return this.getClient(clientOptions);
    }

    return new Promise<any>((resolve?: any, reject?: any) => {
      resolve({
        client: this.defaultClient,
        options: this.defaultClientOptions
      });
    });
  }

  /**
   * 复制指定的内容到剪切板
   * @param text
   */
  public copyTextToClipboard(text: string = "") {
    if (!text) {
      return false;
    }
    var copyFrom = $("<textarea/>");
    copyFrom.text(text);
    $("body").append(copyFrom);
    copyFrom.select();
    document.execCommand("copy");
    copyFrom.remove();
    return true;
  }

  /**
   * 获取指定客户端的可用空间
   * @param data
   */
  public getFreeSpace(data: any): Promise<any> {
    if (!data.clientId) {
      return this.getDefaultClientFreeSpace(data);
    }

    return new Promise<any>((resolve?: any, reject?: any) => {
      let clientOptions: any = this.options.clients.find((item: any) => {
        return item.id === data.clientId;
      });

      if (clientOptions) {
        this.getClient(clientOptions).then((result: any) => {
          result.client.call(EAction.getFreeSpace, data).then((result: any) => {
            resolve(result);
          });
        });
      }
    });
  }

  /**
   * 获取默认客户端的可用空间
   * @param data
   */
  public getDefaultClientFreeSpace(data: any): Promise<any> {
    return new Promise<any>((resolve?: any, reject?: any) => {
      this.defaultClient
        .call(EAction.getFreeSpace, data)
        .then((result: any) => {
          resolve(result);
        });
    });
  }

  public updateOptionsTabId(id: number) {
    this.optionsTabId = id;
  }

  public openOptions(searchKey: string = "") {
    if (this.optionsTabId == 0) {
      this.createOptionTab(searchKey);
    } else {
      chrome.tabs.get(this.optionsTabId as number, tab => {
        if (!chrome.runtime.lastError && tab) {
          let url = "index.html";
          if (searchKey) {
            url = `index.html#/search-torrent/${searchKey}`;
          }
          chrome.tabs.update(tab.id as number, { selected: true, url: url });
        } else {
          this.createOptionTab(searchKey);
        }
      });
    }
  }

  private createOptionTab(searchKey: string = "") {
    let url = "index.html";
    if (searchKey) {
      url = `index.html#/search-torrent/${searchKey}`;
    }
    chrome.tabs.create(
      {
        url: url
      },
      tab => {
        this.optionsTabId = tab.id;
      }
    );
  }

  /**
   * 根据指定的站点获取站点的架构信息
   * @param site 站点信息
   */
  private getSiteSchema(site: Site): SiteSchema {
    let schema: SiteSchema = {};
    if (typeof site.schema === "string") {
      schema =
        this.options.system &&
        this.options.system.schemas &&
        this.options.system.schemas.find((item: SiteSchema) => {
          return item.name == site.schema;
        });
    } else {
      let site: Site =
        this.options.system &&
        this.options.system.sites &&
        this.options.system.sites.find((item: Site) => {
          return item.host == site.host;
        });
      if (site && site.schema) {
        schema = site.schema;
        schema.siteOnly = true;
      }
    }

    return schema;
  }

  private replaceKeys(source: string, keys: Dictionary<any>): string {
    let result: string = source;

    for (const key in keys) {
      if (keys.hasOwnProperty(key)) {
        const value = keys[key];
        result = result.replace("$" + key + "$", value);
      }
    }
    return result;
  }
}
