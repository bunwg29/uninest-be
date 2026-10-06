module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@common(.*)$': '<rootDir>/src/common$1',
    '^@core(.*)$': '<rootDir>/src/core$1',
    '^@modules(.*)$': '<rootDir>/src/modules$1',
  },
  collectCoverageFrom: [
    'src/modules/booking/**/*.ts',
    '!src/modules/booking/**/*.module.ts',
  ],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
};
