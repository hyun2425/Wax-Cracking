import type { Metadata } from "next";
import WalkQuestGame from "./WalkQuestGame";

export const metadata: Metadata = {
  title: "루비 감자와 산책",
  description: "루비와 감자를 데리고 동네 한 바퀴를 도는 1인칭 산책 시뮬레이션 게임",
};

export default function RubyGamjaWalkQuestPage() {
  return <WalkQuestGame />;
}
