export function checkReviewForSpam(review: { comment: string; title?: string }) {
  const blockedWords = ["hate", "adult"];
  const spamPatterns = [/http/i, /\.com/i, /\+91\d{10}/, /@gmail/i];
  
  const text = `${review.title || ""} ${review.comment}`.toLowerCase();

  for (const word of blockedWords) {
    if (text.includes(word)) return { flag: true, reason: "Abusive language" };
  }

  for (const pattern of spamPatterns) {
    if (pattern.test(text)) return { flag: true, reason: "Spam / promotional content" };
  }

  return { flag: false };
}
