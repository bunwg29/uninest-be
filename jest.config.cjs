module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json', useESM: true }],
  },
  moduleNameMapper: {
    '^@common$': '<rootDir>/src/common',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@core$': '<rootDir>/src/core',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@modules$': '<rootDir>/src/modules',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:@nestjs|@borewit|file-type|strtok3|token-types)/)',
  ],
  collectCoverageFrom: ['src/modules/price-comparison/**/*.ts'],
};
