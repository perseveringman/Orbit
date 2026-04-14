const PODCAST_OUTLINE_TITLE_CLASS_NAME = [
  'block',
  'flex-1',
  'min-w-0',
  'whitespace-normal',
  'break-words',
  'text-[13px]',
  'leading-5',
  'text-gray-300',
].join(' ');

export function getPodcastOutlineTitleClassName(): string {
  return PODCAST_OUTLINE_TITLE_CLASS_NAME;
}
