module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    // TODO: remove isolatedModules once Task 6 resolves v4 errors in src/notion.ts
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {isolatedModules: true}],
    },
};
