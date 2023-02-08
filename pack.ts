import * as coda from '@codahq/packs-sdk';
import * as OneAI from 'oneai';
import moment from 'moment-timezone';
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

const parameters: coda.ParamDefs = [
  coda.makeParameter({
    type: coda.ParameterType.Html,
    name: 'doc',
    description: 'Document to analyze.',
    optional: true,
  }),
  coda.makeParameter({
    type: coda.ParameterType.String,
    name: 'text',
    description: 'Text to analyze.',
    optional: true,
  }),
  coda.makeParameter({
    type: coda.ParameterType.String,
    name: 'url',
    description: 'URL to scrape and analyze.',
    optional: true,
  }),
];

async function executePipeline(
  [doc, text, url]: any,
  context: coda.ExecutionContext,
  ...skills: OneAI.Skill[]
): Promise<OneAI.Output> {
  const htmlInput = doc || url;
  let conversation;
  if (!(htmlInput || text)) {
    throw new Error('Must provide either text or url.');
  }
  const oneai = new OneAICoda(context);
  try {
    conversation = oneai.parsing.parseConversation(text);
  } catch (e) { /** */ }
  const pipeline = (htmlInput)
    ? new oneai.Pipeline(oneai.skills.htmlToArticle(), ...skills)
    : new oneai.Pipeline(...skills);
  const output = await pipeline.run(htmlInput || conversation || text);
  return (htmlInput) ? output.htmlArticle! : output;
}

pack.addFormula({
  name: 'Topics',
  description: 'Automatically tag text with topics.',

  parameters,

  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.String },

  async execute(params, context) {
    const { topics } = await executePipeline(params, context, OneAI.skills.topics());
    return topics?.map((t) => `#${(t.value as string).replace(/\s+/g, '_')}`) || [];
  },
});

pack.addFormula({
  name: 'Summarize',
  description: 'Summarize a text.',
  // short med long

  parameters: [
    ...parameters,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'length',
      description: 'Summary length.',
      optional: true,
      suggestedValue: 'normal',
      autocomplete: ['normal', 'long', 'short'],
    }),
  ],

  resultType: coda.ValueType.String,

  async execute(params, context) {
    const lengths: Record<any, [number, number]> = {
      normal: [50, 100],
      short: [20, 40],
      long: [100, 200],
    };
    const [doc, text, url, length] = params;
    const { summary } = await executePipeline([doc, text, url], context, OneAI.skills.summarize({
      min_length: lengths[length || 'normal'][0],
      max_length: lengths[length || 'normal'][1],
    }));
    return (summary?.text || '') as string;
  },
});

pack.addFormula({
  name: 'Highlights',
  description: 'Detect key sentences in a text.',

  parameters,

  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.String },

  async execute(params, context) {
    const { highlights } = await executePipeline(params, context, OneAI.skills.highlights());
    return highlights?.sort((t) => t.outputSpans[0].section)?.map((t) => t.value as string) || [];
  },
});

pack.addFormula({
  name: 'Headline',
  description: 'Automatically generate a headline for a text.',

  parameters,

  resultType: coda.ValueType.String,

  async execute(params, context) {
    const { headline } = await executePipeline(params, context, OneAI.skills.headline());
    return (headline?.[0]?.value || '') as string;
  },
});

pack.addFormula({
  name: 'Chapters',
  description: 'Automatically split a text into chapters based on content.',

  parameters: [
    ...parameters,
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'amount',
      description: 'Amount of chapters to create.',
      optional: true,
      suggestedValue: 'normal',
      autocomplete: ['normal', 'less', 'more'],
    }),
  ],

  resultType: coda.ValueType.Array,
  items: coda.makeObjectSchema({
    name: 'Chapter',
    properties: {
      title: { type: coda.ValueType.String },
      text: { type: coda.ValueType.String },
      start: { type: coda.ValueType.Number },
      end: { type: coda.ValueType.Number },
    },
  }),

  async execute(params, context) {
    const [doc, text, url, amount] = params;
    const splitByTopic = OneAI.skills.splitByTopic();
    splitByTopic.params = {
      amount: amount || 'normal',
    };
    const output = await executePipeline([doc, text, url], context, OneAI.skills.splitByTopic());
    const captions = (typeof output?.text === 'string') ? [{
      utterance: output?.text,
      timestamp: undefined,
    }] : output?.text as OneAI.Conversation;
    const chapters = output?.segments?.map((c) => ({
      title: c.data.subheading,
      text: c.outputSpans.map((span) => {
        const { section, start, end } = span;
        return captions[section]?.utterance?.slice(start, end) || '';
      }).join('\n'),
      start: captions?.[c.outputSpans[0].section]?.timestamp || 0,
      end: captions?.[c.outputSpans[c.outputSpans.length - 1].section]?.timestamp || 0,
    }));
    return chapters || [];
  },
});

pack.addFormula({
  name: 'Names',
  description: 'Detect names of people, products, locations etc. in the text.',

  parameters,

  resultType: coda.ValueType.Array,
  items: coda.makeObjectSchema({
    name: 'Name',
    properties: {
      name: { type: coda.ValueType.String },
      type: { type: coda.ValueType.String },
    },
  }),

  async execute(params, context) {
    const { names } = await executePipeline(params, context, OneAI.skills.names());
    return names?.map((name) => ({
      name: name.spanText,
      type: name.name,
    })) || [];
  },
});

pack.addFormula({
  name: 'Emotions',
  description: 'Detect emotions i.e. happiness, sadness, anger etc. in the text.',

  parameters,

  resultType: coda.ValueType.Array,
  items: coda.makeObjectSchema({
    name: 'Emotion',
    properties: {
      text: { type: coda.ValueType.String },
      emotion: { type: coda.ValueType.String },
    },
  }),

  async execute(params, context) {
    const { emotions } = await executePipeline(params, context, OneAI.skills.emotions());
    return emotions?.map((emotion) => ({
      text: emotion.spanText,
      emotion: emotion.name,
    })) || [];
  },
});

pack.addFormula({
  name: 'Sentiments',
  description: 'Detect negative or positive sentiment in the text.',

  parameters,

  resultType: coda.ValueType.Array,
  items: coda.makeObjectSchema({
    name: 'Sentiment',
    properties: {
      text: { type: coda.ValueType.String },
      sentiment: { type: coda.ValueType.String },
    },
  }),

  async execute(params, context) {
    const { sentiments } = await executePipeline(params, context, OneAI.skills.sentiments());
    return sentiments?.map((sentiment) => ({
      text: sentiment.spanText,
      sentiment: sentiment.value as string,
    })) || [];
  },
});

pack.addFormula({
  name: 'DatesAndTimes',
  description: 'Detect and parse dates and times in the text.',

  parameters: [
    ...parameters,
    coda.makeParameter({
      type: coda.ParameterType.Date,
      name: 'baseTime',
      description: 'Base date & time to use for relative dates (e.g. "tomorrow").',
      optional: true,
    }),
  ],

  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.Number, codaType: coda.ValueHintType.DateTime },

  async execute(params, context) {
    const [doc, text, url, base] = params;
    const { numbers } = await executePipeline(
      [doc, text, url],
      context,
      OneAI.skills.numbers(base && {
        reference_time: moment.tz(base, context.timezone).toISOString(true).replace(/([+-]\d{2}):(\d{2})$/, ''),
      }),
    );
    return numbers
      ?.filter((number) => ['DATE', 'TIME'].includes(number.name))
      ?.map((datetime) => moment.tz(datetime.data.date_time, context.timezone).valueOf() / 1000)
      || [];
  },
});

pack.addFormula({
  name: 'Numbers',
  description: 'Detect and parse numbers and quantities in the text.',

  parameters,

  resultType: coda.ValueType.Array,
  items: { type: coda.ValueType.Number },

  async execute(params, context) {
    const { numbers } = await executePipeline(params, context, OneAI.skills.numbers());
    return numbers
      ?.filter((number) => ['NUMBER', 'QUANTITY', 'MONEY', 'ORDINAL'].includes(number.name))
      ?.map((number) => number.data.numeric_value)
      || [];
  },
});
