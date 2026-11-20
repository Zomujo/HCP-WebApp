import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts'] },
  {
    // React Compiler rules new in eslint-config-next 16. The existing pages
    // break them in ways that work at run time (setState in effects, a
    // function used before its declaration inside an effect). Warn until the
    // pages are refactored, then turn them back into errors.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];

export default config;
