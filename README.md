# NotebookLM Slide Editor

PDF/이미지 슬라이드의 글자를 지우고 바꿔 쓰는 로컬 편집기. 영역을 지정하면 Gemini가 글자를 읽고, 원본과 가장 비슷한 한글 글씨체를 찾아 적용한다.

## 실행

**필요:** Node.js, Gemini API 키

1. 패키지 설치: `npm install`
2. `.env.example` 을 `.env.local` 로 복사하고 `GEMINI_API_KEY` 에 키 넣기 — https://aistudio.google.com/apikey 에서 발급 (`.env.local` 은 git 에 올라가지 않음)
3. 실행: `npm run dev` → http://localhost:3000

무료 등급은 하루 20회 제한이 있고, 분석 한 번에 2회(글자 인식 + 글씨체 비교)를 쓴다. 한도를 풀려면 API 키 프로젝트에 결제를 연결한다.

API 키가 브라우저 코드에 포함되므로 내 PC에서만 쓰고, 빌드 결과물(`dist`)을 인터넷에 올리지 말 것.
