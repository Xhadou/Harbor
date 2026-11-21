import type { CardBadge } from "@/components/card-score-stack";

/**
 * A score as a line of text, for the caption under a card's title: who gave
 * it, then the number. On macOS the poster carries no score chip; the score
 * reads here instead.
 */
export function cardBadgeCaption(badge: CardBadge): string {
  switch (badge.kind) {
    case "rating":
      return `${badge.source === "mal" ? "MAL" : badge.source === "tmdb" ? "TMDB" : "IMDb"} ${badge.value}`;
    case "rt":
      return `Rotten Tomatoes ${Math.round(badge.value)}%`;
    case "audience":
      return `Audience ${Math.round(badge.value)}%`;
    case "metacritic":
      return `Metacritic ${Math.round(badge.value)}`;
    case "letterboxd":
      // Kept out of ten; shown out of five, as Letterboxd does.
      return `Letterboxd ${(badge.value / 2).toFixed(1)}`;
    case "mdblist":
      return `MDBList ${Math.round(badge.value)}`;
    case "trakt":
      return `Trakt ${Math.round(badge.value)}%`;
    case "simkl":
      return `Simkl ${Math.round(badge.value)}`;
  }
}
