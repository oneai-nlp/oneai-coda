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
    return `Tags: ${topics?.map((t) => `#${(t.value as string).replace(' ', '_')}`).join(', ')}`;
  },
});

// upload version: npx coda upload pack.ts --notes "Initial version."
