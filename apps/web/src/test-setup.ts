import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { installMockAudio, resetMockAudioInstances } from './test-support/mock-audio';

installMockAudio();

beforeEach(() => {
  resetMockAudioInstances();
});

afterEach(() => {
  cleanup();
});
