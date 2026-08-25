import { useMemo, useState } from "react";
import PageShell from "../components/PageShell.jsx";
import Sunburst from "../components/charts/Sunburst.jsx";
import TopBars from "../components/charts/TopBars.jsx";
import { fmtPct, fmtPeople, pct1, asParticle } from "../lib/format.js";
import { dist, jobTree, topJobs, namedJobs, etcJobs, meta } from "../lib/data.js";

const STAGE_LABEL = {
  "미전직": "전직 전",
  "0": "전직 직후",
  "1": "1차 각성",
  "2": "2차 각성",
  "眞": "진 각성",
};

export default function Jobs() {
  const [focus, setFocus] = useState(null);
  const [hover, setHover] = useState(null);

  const groupOf = useMemo(() => {
    const m = new Map();
    for (const g of jobTree.groups) for (const c of g.children) m.set(c.job, g.group);
    return (job) => m.get(job) ?? null;
  }, []);

  const top5Sum = topJobs.slice(0, 5).reduce((s, j) => s + j.count, 0);
  const etcKinds = etcJobs ? Number(etcJobs.jobName.replace(/[^0-9]/g, "")) : 0;
  const finalStage = dist.stage.find((s) => s.stage === "眞");

  return (
    <PageShell
      id="jobs"
      question="이 페이지가 답하는 질문은 하나입니다. 어떤 직업이 표본에 가장 많이 들어왔습니까?"
      statValue={pct1(topJobs[0].pct)}
      statUnit="%"
      statLabel={`${topJobs[0].jobName}, 표본에서 가장 많은 직업`}
      statNote={fmtPeople(topJobs[0].count)}
      visual={
        <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-center">
          <Sunburst tree={jobTree} focus={focus} setFocus={setFocus} hover={hover} setHover={setHover} />
          <div>
            <p className="t-eyebrow m-0 mb-2">인원이 많은 직업 15종</p>
            <TopBars items={topJobs} hover={hover} setHover={setHover} groupOf={groupOf} />
          </div>
        </div>
      }
      visualCaption="왼쪽 고리와 오른쪽 목록은 함께 움직입니다. 한쪽에 마우스를 올리면 다른 쪽에서도 같은 직업이 밝아집니다."
      explain={[
        `직업 이름은 전직 단계를 하나로 합쳐 최종 전직명으로 맞추었습니다. 표본 ${fmtPeople(meta.sampleSize)} 안에서 이름을 공개할 수 있는 직업은 ${namedJobs.length}종이고, 표본이 10명이 되지 않는 직업 ${etcKinds}종은 ${fmtPeople(etcJobs.count)}으로 한 줄에 합쳤습니다.`,
        `가장 많은 직업은 ${asParticle(topJobs[0].jobName)} ${fmtPct(topJobs[0].pct)}입니다. 상위 5개 직업을 합치면 ${fmtPeople(top5Sum)}으로 ${fmtPct((top5Sum / meta.sampleSize) * 100)}이며, 넷 중 하나에 가깝습니다.`,
        `각성 단계로 보면 진 각성이 ${fmtPct(finalStage.pct)}로 표본 대부분을 차지합니다. 검색에 잘 잡히는 캐릭터가 이미 성장을 마친 쪽에 몰려 있을 가능성이 있습니다.`,
        "이 순위는 표본 안에서의 순위입니다. 검색 한도 편향이 남아 있으므로 게임 전체 인구의 직업 순위라고 읽을 수 없습니다.",
      ]}
      details={
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="t-eyebrow m-0 mb-2">직업별 인원 전체</p>
            <div className="scroll-x" style={{ maxHeight: 420 }}>
              <table className="plain">
                <thead>
                  <tr><th>직업</th><th className="text-right">인원</th><th className="text-right">비중</th></tr>
                </thead>
                <tbody>
                  {dist.job.map((j) => (
                    <tr key={j.jobName}>
                      <td>{j.jobName}</td>
                      <td className="num text-right">{fmtPeople(j.count)}</td>
                      <td className="num text-right">{fmtPct(j.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-8">
            <div>
              <p className="t-eyebrow m-0 mb-2">직업군별 인원</p>
              <table className="plain">
                <thead>
                  <tr><th>직업군</th><th className="text-right">인원</th><th className="text-right">비중</th></tr>
                </thead>
                <tbody>
                  {dist.jobGroup.map((g) => (
                    <tr key={g.jobName}>
                      <td>{g.jobName}</td>
                      <td className="num text-right">{fmtPeople(g.count)}</td>
                      <td className="num text-right">{fmtPct(g.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="t-eyebrow m-0 mb-2">각성 단계별 인원</p>
              <table className="plain">
                <thead>
                  <tr><th>단계</th><th className="text-right">인원</th><th className="text-right">비중</th></tr>
                </thead>
                <tbody>
                  {dist.stage.map((s) => (
                    <tr key={s.stage}>
                      <td>{STAGE_LABEL[s.stage] ?? s.stage}</td>
                      <td className="num text-right">{fmtPeople(s.count)}</td>
                      <td className="num text-right">{fmtPct(s.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    />
  );
}
