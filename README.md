# Arad Census — 던파 캐릭터 표본조사

던전앤파이터 캐릭터 **31,523명 표본**을 Neople 오픈 API로 추출해, 유저들이 지금
어떻게 플레이하고 있는지(직업 분포, 성장 단계, 활성도, 직업 간 격차)를 통계조사
방법론으로 분석한 리포트. [DNF Market Analyst](https://github.com/Yegeon99/dnf-market-analyst)의
형제 프로젝트 — 시장에 이어 **유저**를 보는 두 번째 축.

> 이 조사는 모집단 추정이 아니라 **표본조사 방법론의 시연**이다.
> 표본 추출 방식의 편향과 한계를 리포트의 "조사 방법과 한계" 화면과
> [data/bias_notes.md](data/bias_notes.md)에 그대로 공개한다.

## 리포트 구성

화면 7개를 상단 내비게이션과 해시 라우팅으로 나눈 페이지형 리포트다. 한 화면에
한 주제만 담고, 화면마다 이 리포트만의 메인 시각화를 하나씩 둔다.

| 화면 | 주소 | 메인 시각화 |
| --- | --- | --- |
| 한눈에 보기 | `#overview` | 표본 피라미드 두 개 (입체, 평면 대체) |
| 직업 | `#jobs` | 직업군에서 전직으로 내려가는 2단 선버스트 + 상위 15 가로 바 |
| 성장 단계 | `#growth` | 좌우 대칭 피라미드 + 전체/완전 검색 슬라이더, 명성 히스토그램 |
| 활성도 | `#activity` | 보정 전후 모핑 스택 바, 구간별 스트림 |
| 직업과 성장 격차 | `#gap` | 직업 20 × 구간 6 입체 지형 (평면은 히트맵), 레이드 진입 지수 |
| AI 인사이트 | `#insights` | 가로 카드 덱 + 확신도 필터 + 카드별 미니 차트 |
| 조사 방법과 한계 | `#method` | 표본 설계 흐름도, 편향 목록, 개인정보와 실측치 |

입체 화면은 모두 지연 로딩하며, 좁은 화면·움직임 최소화 설정·그래픽 미지원
환경에서는 자동으로 평면 화면으로 대체된다. 모든 입체 화면에 "평면으로 보기"
토글이 있다.

## 구조

```
pipeline/            # Python 파이프라인 (이번 개편에서 손대지 않음)
  api_client.py      # Neople API 클라이언트 (0.3초 대기·재시도 1회)
  sample.py          # CS-1 시드 검색 → 표본 프레임 (체크포인트 재개)
  timeline.py        # CS-2 층화 서브샘플 → 활성도 판정
  aggregate.py       # CS-3 집계·마스킹·식별 정보 폐기 검증
  insights.py        # CS-4 AI 인사이트 (배치 1회)
config/              # 시드·명성 구간·활성 기준·직업 정규화 맵
data/                # 집계 결과 (식별 정보 없음) + 편향 노트
report/              # Vite + React 페이지형 리포트
  content/copy.md    # 화면 문구 전문 (빌드 산출물에서 자동 추출)
  src/derived/       # 리포트 전용 파생 데이터 (인사이트 문장, 히스토그램, 직업 트리)
  scripts/           # 데이터 변환·파생·캡처·문구 추출·검사 스크립트
scripts/             # 검증·스캔·대조 스크립트
docs/quality.md      # Lighthouse 점수와 지표 실측
```

## 재현

```bash
# .env에 NEOPLE_API_KEY (인사이트는 ANTHROPIC_API_KEY 추가)
python -m venv .venv && .venv/Scripts/pip install requests python-dotenv tzdata anthropic
.venv/Scripts/python pipeline/sample.py       # 표본 수집 (약 290콜, 90초)
.venv/Scripts/python pipeline/timeline.py     # 활성도 조사 (600콜, 3분)
.venv/Scripts/python pipeline/aggregate.py    # 집계 → data/census_*.json
.venv/Scripts/python scripts/rewrite_insights.py  # 인사이트 문장 (배치 1회)
.venv/Scripts/python scripts/purge_ids.py     # 식별 정보 폐기 + 스캔

cd report
npm install
node scripts/derive.mjs        # 명성 히스토그램·직업 트리 (체크포인트 필요, 로컬 1회)
npm run build                  # 화면 용어 변환 + 빌드
node scripts/serif-glyphs.mjs  # 세리프로 쓰는 글자만 골라 글꼴 주소 좁히기
node scripts/capture.mjs       # 캡처 16장 + 화면 글 모음
node scripts/build-copy.mjs    # 화면 문구 전문 → content/copy.md
cd .. && python scripts/verify_final.py       # 숫자 정합성 + 금지 표현 스캔
```

`report/scripts/sync-data.mjs`가 빌드 직전에 집계 파일을 읽어 내부 키 이름과
내부 용어를 화면 용어로 바꾼 사본을 만든다. 원본 집계 파일은 바꾸지 않는다.

## 데이터 윤리 원칙

- 캐릭터명·모험단명·길드명은 **수집·저장하지 않는다**. characterId는 타임라인
  조사 직후 sha256 해시로 치환 폐기하며, 커밋되는 어떤 파일에도 식별 정보가
  없다 (자동 스캔 0건 통과).
- 특정 캐릭터를 지목하는 서술 금지. 표본 10명 미만 셀은 공개하지 않는다.
- API 매너: 호출 간 0.3초 대기, 재시도 1회, 1회성 배치 (상시 스케줄 아님).
  총 호출량 사전 추정·사후 실측 공개 (누적 약 933회, 실패 0).
- LLM 비용 실측 공개: $0.0890 (인사이트 배치 3회 누적, 문장 재작성 1회 포함).

## 고지

본 서비스는 Neople 오픈 API에서 제공받은 데이터를 일부 가공하여 활용하고 있습니다.
비공식 팬메이드 포트폴리오 — ㈜네오플·넥슨과 무관합니다. 게임 IP 아트워크를 사용하지 않습니다.
