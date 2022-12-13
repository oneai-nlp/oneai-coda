import { buildError } from 'oneai/lib/src/api/mapping';
import * as coda from '@codahq/packs-sdk';
import {
  OneAI, HttpApiClient, ApiClientParams, ApiReqParams, HttpResponse,
} from 'oneai';
import { version } from './package.json';

class CodaFetcherAPIClient implements HttpApiClient {
  private agent = `coda-pack/${version}`;

  params: ApiClientParams;

  coda: coda.ExecutionContext;

  constructor(context: coda.ExecutionContext, params: ApiClientParams) {
    this.params = params;
    this.coda = context;
  }

  async get(path: string, params?: ApiReqParams): Promise<HttpResponse> {
    try {
      const response = await this.coda.fetcher.fetch({
        method: 'GET',
        url: `${params?.baseURL || this.params.baseURL}/${path}`,
        headers: {
          'api-key': params?.apiKey || this.params.apiKey || `{{apiKey-${this.coda.invocationToken}}}`,
          'Content-Type': 'application/json',
          'User-Agent': this.agent,
        },
        cacheTtlSecs: 0,
      });

      return { ...response, data: response.body } as HttpResponse;
    } catch (e) {
      throw buildError(e);
    }
  }

  async post(path: string, data: string | Buffer, params?: ApiReqParams): Promise<any> {
    try {
      const response = await this.coda.fetcher.fetch({
        method: 'POST',
        url: `${params?.baseURL || this.params.baseURL}/${path}`,
        headers: {
          'api-key': params?.apiKey || this.params.apiKey || `{{apiKey-${this.coda.invocationToken}}}`,
          'Content-Type': 'application/json',
          'User-Agent': this.agent,
        },
        body: data,
        cacheTtlSecs: 0,
      });

      return { ...response, data: response.body };
    } catch (e) {
      throw buildError(e);
    }
  }
}

export default class OneAICoda extends OneAI {
  constructor(
    context: coda.ExecutionContext,
    params?: Partial<ApiClientParams>,
  ) {
    super(undefined, {
      client: new CodaFetcherAPIClient(context, { ...OneAI.defaultParams, ...(params || {}) }),
    });
  }
}
