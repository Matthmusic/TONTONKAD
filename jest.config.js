module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/main/main.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
