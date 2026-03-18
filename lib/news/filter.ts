export function shouldKeepPostForDigest(input: {
  isTopicOp: boolean;
  isNewTopicThisWeek?: boolean;
  contentText: string;
  authorUsername: string;
  signalScore: number;
}) {
  if (input.isTopicOp) {
    return true;
  }

  const normalizedText = input.contentText.trim();
  const minLength = input.isNewTopicThisWeek ? 24 : 18;
  if (normalizedText.length < minLength) {
    return false;
  }

  return input.signalScore > 0;
}
