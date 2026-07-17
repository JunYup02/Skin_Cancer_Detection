# Skin Cancer Detector (Demo)

피부 병변 사진을 업로드하면 AI가 HAM10000 데이터셋 기준 7개 병변 클래스로 분류하고,
예측 신뢰도 기반 위험도와 후속 안내(피부과 방문 권장 / 일반 관리 팁)를 보여주는 데모 서비스.
고위험 판정 시 브라우저 위치 기반으로 근처 피부과를 구글맵에서 찾을 수 있고, 분석 결과를
PDF 리포트로 다운로드할 수 있다. (PRD.md 참고)

## 구조

- `backend/` — FastAPI. `/api/analyze`, `/api/report`(PDF) 제공. 단일 서비스로 빌드된
  프론트엔드 정적 파일도 서빙. 로그인/DB 없이 완전히 무상태(stateless)로 동작.
  - `backend/ml/` — 합성 데이터 생성 + 분류 모델 학습 스크립트, 이미지 특징 추출
  - `backend/app/` — API, 이미지 품질 검사, 예측기(predictor) 추상화, PDF 생성
- `frontend/` — React + Tailwind (Vite)

## 모델에 대한 중요한 전제

이번 데모에는 실제 Vertex AI 엔드포인트나 HAM10000 데이터셋 접근 권한이 없다. 대신:

1. 이미지에서 색상 분산, 비대칭성, 경계 불규칙성 등 6가지 가벼운 특징을 추출한다
   (`backend/ml/features.py`, ABCD 규칙에서 착안했지만 검증된 피부과 알고리즘은 아님).
2. 각 클래스별로 그럴듯한 특징 분포를 손으로 설계한 **합성 데이터**로 RandomForest
   분류기를 학습시킨다 (`backend/ml/synthetic_data.py`). SafeTrade Detector가 합성
   거래 데이터로 학습한 것과 같은 패턴이다.

**즉 이 분류 결과는 실제 임상 데이터로 검증되지 않았으며, 의학적 진단으로 사용해서는 안 된다.**
프론트엔드와 PDF 리포트에 이 사실을 명시하고 있다.

### Vertex AI 연동

`backend/app/predictor.py`에 `Predictor` 추상 클래스와 `LocalDemoPredictor`(기본값),
`VertexAIPredictor`(AutoML 이미지 분류 엔드포인트 호출 구현 완료)가 준비되어 있다.
[Vertex AI 이미지 분류 예측 샘플](https://github.com/googleapis/python-aiplatform/blob/main/samples/snippets/prediction_service/predict_image_classification_sample.py)
과 동일한 방식(`aiplatform.gapic.PredictionServiceClient` + `ImageClassificationPredictionInstance`)으로
호출하며, 응답의 `displayNames`/`confidences`를 `app/classes.py`의 `CLASS_ORDER` 7개 클래스 코드에 매핑한다.

**전제 조건:** Vertex AI(AutoML Vision)에 배포한 모델의 라벨명이 `CLASS_ORDER`의 클래스 코드
(`akiec`, `bcc`, `bkl`, `df`, `mel`, `nv`, `vasc`)와 정확히 일치해야 한다. 다르면 해당 클래스는
확률 0으로 처리된다.

실제 Vertex AI 엔드포인트를 사용하려면:

1. `PREDICTOR_BACKEND=vertex` 환경변수 설정
2. `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`(예: `us-central1`), `VERTEX_ENDPOINT_ID` 설정
3. `GOOGLE_APPLICATION_CREDENTIALS`를 서비스 계정 키 JSON 파일 경로로 설정
   - Render에서는 "Secret Files" 기능으로 키 JSON을 업로드하고, 그 마운트 경로를
     `GOOGLE_APPLICATION_CREDENTIALS`로 지정한다 (`render.yaml`에 관련 env var는
     `sync: false`로 이미 등록되어 있어 대시보드에서 값만 채우면 된다).
4. `pip install -r backend/requirements.txt`로 `google-cloud-aiplatform` 설치

로컬에서 확인하려면:

```bash
export PREDICTOR_BACKEND=vertex
export VERTEX_PROJECT_ID=<project-id>
export VERTEX_LOCATION=us-central1
export VERTEX_ENDPOINT_ID=<endpoint-id>
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
uvicorn app.main:app --reload --port 8000
```

## 로컬 실행

```bash
# 백엔드
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m ml.train_model
uvicorn app.main:app --reload --port 8000

# 프론트엔드 (개발 모드, 별도 터미널)
cd frontend
npm install
npm run dev   # http://localhost:5173, /api는 8000번으로 프록시
```

프로덕션처럼 단일 서비스로 확인하려면 `frontend`를 빌드한 뒤 백엔드만 띄우면 된다
(백엔드가 `frontend/dist`를 자동으로 서빙한다):

```bash
cd frontend && npm run build
cd ../backend && uvicorn app.main:app --port 8000
```

## Render 배포

`render.yaml` 기준 단일 웹 서비스로 배포된다.

- Build: `bash build.sh` (프론트 빌드 → 백엔드 의존성 설치 → 모델 학습)
- Start: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

DB나 영속 스토리지가 없으므로 별도 디스크 설정이 필요 없다.

## v1 데모 범위 밖

- 회원가입/로그인(JWT), 분석 이력 저장 (요청에 따라 이번 데모에서는 제외; 로그인 없이
  업로드 → 분석 → PDF 다운로드 흐름만 제공)
- 실제 Vertex AI 연동 (위 "Vertex AI로 교체하기" 참고)
- Google Places API 기반 실제 병원 정보 (좌표/평점/영업시간 등) — 대신 브라우저 위치 +
  구글맵 검색 링크로 대체
- 이미지 품질 검사는 해상도·블러 정도만 확인 (실제 임상 촬영 가이드라인 수준은 아님)
- 다중 병변 탐지, 시간 경과에 따른 자동 추적, EHR 연동, 실시간 상담/예약
