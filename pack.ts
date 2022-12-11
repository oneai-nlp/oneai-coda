import * as coda from '@codahq/packs-sdk';
import oneAICodaClient from './oneai-client';

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

pack.addFormula({
  name: 'AutoTags',
  description: 'Automatically tag text with topics.',

  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Html,
      name: 'input',
      description: 'The text to tag.',
    }),
  ],

  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Markdown,

  async execute([inputText], context) {
    const oneai = oneAICodaClient(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.topics(),
    );
    const { topics } = await pipeline.run(inputText);
    return `Tags: ${topics?.map((t) => `#${(t.value as string).replace(' ', '_')}`).join(' ')}`;
  },
});

pack.addFormula({
  name: 'YouTubeSummary',
  description: 'Summarize content of YouTube video.',

  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'videoURL',
      description: 'Full URL of a YouTube Video i.e "https://www.youtube.com/watch?v=D-LymTjyuP4"',
    }),
  ],

  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Markdown,

  async execute([inputText], context) {
    const oneai = oneAICodaClient(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.htmlToArticle(),
      oneai.skills.summarize(),
    );
    const output = (await pipeline.run(inputText)).htmlArticle!;

    const title = output.htmlFields?.filter((f) => f.name === 'title')[0].value;
    const summary = output?.summary?.text || '';

    return (title) ? `# ${title}\n\n${summary}` : (summary as string);
  },
});

// upload version: npx coda upload pack.ts --notes "Initial version."
