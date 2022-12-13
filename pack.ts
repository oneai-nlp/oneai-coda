import * as coda from '@codahq/packs-sdk';
import { Label } from 'oneai';
import OneAICoda from './oneai-client';

// eslint-disable-next-line import/prefer-default-export
export const pack = coda.newPack();

pack.addNetworkDomain('api.oneai.com');

pack.setUserAuthentication({
  type: coda.AuthenticationType.Custom,
  instructionsUrl: 'https://studio.oneai.com/settings/api-keys',
  params: [
    { name: 'apiKey', description: 'Your API key' },
  ],
});

type Captions = {
  speaker: string,
  utterance: string,
  timestamp: number,
}[]

function textFromCaptions(input: string | Captions, label: Label) {
  const captions = (typeof input === 'string') ? [{ utterance: input }] : input;
  return label.outputSpans.map((span) => {
    const { section, start, end } = span;
    return captions[section]?.utterance?.slice(start, end) || '';
  }).join('\n');
}

const htmlInput: coda.ParamDefs = [
  coda.makeParameter({
    type: coda.ParameterType.Html,
    name: 'text',
    description: 'The text to analyze.',
    optional: true,
  }),
  coda.makeParameter({
    type: coda.ParameterType.String,
    name: 'url',
    description: 'URL to scrape and analyze.',
    optional: true,
  }),
];

function getInputText([text, url]: [any?, any?]) {
  const input = text || url;
  if (input) {
    return input;
  }
  throw new Error('Must provide either text or url.');
}

pack.addFormula({
  name: 'Topics',
  description: 'Automatically tag text with topics.',

  parameters: htmlInput,

  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.String },

  async execute([text, url], context) {
    const inputText = getInputText([text, url]);
    const oneai = new OneAICoda(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.htmlToArticle(),
      oneai.skills.topics(),
    );
    const topics = (await pipeline.run(inputText))?.htmlArticle?.topics;
    return topics?.map((t) => `#${(t.value as string).replace(' ', '_')}`) || [];
  },
});

pack.addFormula({
  name: 'Summarize',
  description: 'Summarize a text.',

  parameters: htmlInput,

  resultType: coda.ValueType.String,

  async execute([text, url], context) {
    const inputText = getInputText([text, url]);
    const oneai = new OneAICoda(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.htmlToArticle(),
      oneai.skills.summarize(),
    );
    return (await pipeline.run(inputText))?.htmlArticle?.summary?.text as string || '';
  },
});

pack.addFormula({
  name: 'Highlights',
  description: 'Detect key sentecnes in a text.',

  parameters: htmlInput,

  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.String },

  async execute([text, url], context) {
    const inputText = getInputText([text, url]);
    const oneai = new OneAICoda(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.htmlToArticle(),
      oneai.skills.highlights(),
    );
    const highlights = (await pipeline.run(inputText))?.htmlArticle?.highlights;
    return highlights?.sort((t) => t.outputSpans[0].section)?.map((t) => t.value as string) || [];
  },
});

pack.addFormula({
  name: 'Headline',
  description: 'Automatically generate a headline for a text.',

  parameters: htmlInput,

  resultType: coda.ValueType.String,

  async execute([text, url], context) {
    const inputText = getInputText([text, url]);
    const oneai = new OneAICoda(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.htmlToArticle(),
      oneai.skills.headline(),
    );
    const headline = (await pipeline.run(inputText))?.htmlArticle?.headline?.[0];
    return headline?.value as string || '';
  },
});

pack.addFormula({
  name: 'Chapters',
  description: 'Automatically split a text into chapters based on content.',

  parameters: htmlInput,

  resultType: coda.ValueType.Array,
  items: coda.makeObjectSchema({
    name: 'Chapter',
    properties: {
      title: { type: coda.ValueType.String },
      text: { type: coda.ValueType.String },
      start: { type: coda.ValueType.String },
    },
  }),

  async execute([text, url], context) {
    const inputText = getInputText([text, url]);
    const oneai = new OneAICoda(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.htmlToArticle(),
      oneai.skills.splitByTopic(),
    );
    const output = (await pipeline.run(inputText))?.htmlArticle;
    const chapters = output?.segments?.map((c) => ({
      title: c.data.subheading,
      text: textFromCaptions(output?.text as Captions, c),
    }));
    return chapters || [];
  },
});

pack.addFormula({
  name: 'Names',
  description: 'Detect names of people, products, locations etc. in the text.',

  parameters: htmlInput,

  resultType: coda.ValueType.Array,
  items: coda.makeObjectSchema({
    name: 'Name',
    properties: {
      name: { type: coda.ValueType.String },
      type: { type: coda.ValueType.String },
    },
  }),

  async execute([text, url], context) {
    const inputText = getInputText([text, url]);
    const oneai = new OneAICoda(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.htmlToArticle(),
      oneai.skills.names(),
    );
    const output = (await pipeline.run(inputText))?.htmlArticle;
    const names = output?.names?.map((name) => ({
      name: name.spanText,
      type: name.name,
    }));
    return names || [];
  },
});
