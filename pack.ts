// This import statement gives you access to all parts of the Coda Packs SDK.
import * as coda from '@codahq/packs-sdk';

import oneAICodaClient from './oneai-client';

// This line creates your new Pack.
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

// Here, we add a new formula to this Pack.
pack.addFormula({
  // This is the name that will be called in the formula builder.
  // Remember, your formula name cannot have spaces in it.
  name: 'Hello',
  description: 'A Hello World example.',

  // If your formula requires one or more inputs, you’ll define them here.
  // Here, we're creating a string input called “name”.
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'name',
      description: 'The name you would like to say hello to.',
    }),
  ],

  // The resultType defines what will be returned in your Coda doc. Here, we're
  // returning a simple text string.
  resultType: coda.ValueType.String,

  // Everything inside this execute statement will happen anytime your Coda
  // formula is called in a doc. An array of all user inputs is always the 1st
  // parameter.
  async execute([inputText], context) {
    const oneai = oneAICodaClient(context);
    const pipeline = new oneai.Pipeline(
      oneai.skills.topics(),
    );
    const { topics } = await pipeline.run(inputText);
    return `Topics: ${topics?.map((t) => t.value).join(', ')}!`;
  },
});

// upload version: npx coda upload pack.ts --notes "Initial version."
