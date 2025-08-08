const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// 파일 업로드 설정
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// uploads 폴더 생성
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// OpenAI API 설정
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('=== 서버 시작 디버깅 ===');
console.log('🔑 API 키 존재:', !!OPENAI_API_KEY);
if (OPENAI_API_KEY) {
    console.log('🔑 API 키 시작 부분:', OPENAI_API_KEY.substring(0, 10) + '...');
    console.log('🔑 API 키 길이:', OPENAI_API_KEY.length);
} else {
    console.log('⚠️ .env 파일에 OPENAI_API_KEY가 설정되지 않았습니다');
}

// 디버깅용 GPT API 호출 함수
async function analyzeWithGPTDebug(text) {
    console.log('\n=== GPT API 호출 시작 ===');
    console.log('📝 입력 텍스트 길이:', text.length);
    console.log('📝 입력 텍스트 미리보기:', text.substring(0, 100) + '...');
    
    if (!OPENAI_API_KEY) {
        console.log('⚠️ API 키가 없어서 목업 데이터 반환');
        return generateMockAnalysis(text);
    }
    
    try {
        const prompt = `다음은 초등학교 수업 내용입니다. 학급일지 형태로 분석해서 JSON 형태로만 응답해주세요.

분석 기준:
1. 학생별 활동 점수 계산
2. 사회정서역량 5개 영역 점수 (1-10점)

반드시 이 JSON 형태로만 응답:
{
  "students": {
    "학생이름": {
      "scores": {
        "발표": 숫자,
        "질문": 숫자,
        "협동칭찬": 숫자,
        "과제수행": 숫자,
        "갈등": 숫자,
        "장난산만": 숫자
      },
      "socialEmotional": {
        "자기인식": 숫자,
        "자기조절": 숫자,
        "사회적인식": 숫자,
        "관계기술": 숫자,
        "책임감의사결정": 숫자
      },
      "interactions": [
        {
          "period": "1교시",
          "type": "발표",
          "content": "구체적 내용",
          "score": 2
        }
      ]
    }
  },
  "summary": "전체 수업 요약"
}

분석할 텍스트:
${text}`;

        console.log('📤 OpenAI API 요청 준비 중...');
        
        // dynamic import for node-fetch
        const fetch = (await import('node-fetch')).default;
        
        const requestBody = {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: '당신은 초등학교 수업 분석 전문 AI입니다. 반드시 요청된 JSON 형태로만 응답하세요. 다른 설명은 하지 말고 JSON만 반환하세요.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 2000,
            temperature: 0.3
        };
        
        console.log('📤 요청 데이터:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 OpenAI API 응답 상태:', response.status);
        console.log('📥 응답 헤더:', response.headers.raw());
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ OpenAI API 오류 응답:', errorText);
            throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📊 OpenAI 전체 응답:', JSON.stringify(data, null, 2));
        
        if (!data.choices || !data.choices[0]) {
            throw new Error('OpenAI 응답에 choices가 없습니다');
        }
        
        const content = data.choices[0].message.content;
        console.log('📝 GPT 생성 내용 원본:');
        console.log('---시작---');
        console.log(content);
        console.log('---끝---');
        
        // JSON 추출 시도
        let jsonResult;
        try {
            // 먼저 전체가 JSON인지 확인
            jsonResult = JSON.parse(content);
            console.log('✅ 전체 내용이 JSON입니다');
        } catch (e) {
            console.log('⚠️ 전체가 JSON이 아님, JSON 부분 추출 시도');
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    jsonResult = JSON.parse(jsonMatch[0]);
                    console.log('✅ JSON 부분 추출 성공');
                } catch (e2) {
                    console.error('❌ JSON 파싱 실패:', e2.message);
                    throw new Error('JSON 파싱에 실패했습니다');
                }
            } else {
                console.error('❌ JSON 형태를 찾을 수 없음');
                throw new Error('응답에서 JSON 형태를 찾을 수 없습니다');
            }
        }
        
        console.log('✅ 최종 파싱된 JSON:', JSON.stringify(jsonResult, null, 2));
        return jsonResult;
        
    } catch (error) {
        console.error('❌ GPT 분석 중 오류:', error);
        console.error('❌ 오류 스택:', error.stack);
        throw error;
    }
}

// Whisper API 호출 함수 (디버깅)
async function transcribeAudioDebug(audioPath) {
    console.log('\n=== Whisper API 호출 시작 ===');
    console.log('🎤 오디오 파일 경로:', audioPath);
    
    if (!OPENAI_API_KEY) {
        console.log('⚠️ API 키가 없어서 목업 텍스트 반환');
        return "목업 텍스트: 오늘 수업에서 준우가 발표를 잘했고, 영민이가 질문을 했습니다. 대성이는 조금 장난을 쳤지만 나중에 집중했습니다.";
    }
    
    try {
        const FormData = require('form-data');
        const fetch = (await import('node-fetch')).default;
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(audioPath));
        formData.append('model', 'whisper-1');
        formData.append('language', 'ko');
        
        console.log('📤 Whisper API 요청 중...');
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        console.log('📥 Whisper API 응답 상태:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Whisper API 오류:', errorText);
            throw new Error(`Whisper API 오류: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📝 Whisper 변환 결과:', data.text);
        return data.text;
        
    } catch (error) {
        console.error('❌ Whisper 변환 오류:', error);
        return "음성 변환에 실패했지만 목업 데이터를 사용합니다: 오늘 수업에서 학생들이 활발하게 참여했습니다.";
    }
}

// 목업 데이터 생성 함수
function generateMockAnalysis(originalText = '') {
    console.log('🎭 목업 데이터 생성 중...');
    
    const students = {
        '준우': {
            scores: { 발표: 4, 질문: 2, 협동칭찬: 3, 과제수행: 2, 갈등: 0, 장난산만: 0 },
            socialEmotional: { 자기인식: 9, 자기조절: 8, 사회적인식: 7, 관계기술: 8, 책임감의사결정: 7 },
            interactions: [
                { period: '1교시', type: '발표', content: '우산꽂이 필요성에 대해 근거를 들어 발표함', score: 2 },
                { period: '1교시', type: '협동/칭찬', content: '교사: 준우는 발표를 잘 준비했네요', score: 2 }
            ]
        },
        '영민': {
            scores: { 발표: 3, 질문: 1, 협동칭찬: 4, 과제수행: 2, 갈등: 0, 장난산만: 0 },
            socialEmotional: { 자기인식: 8, 자기조절: 9, 사회적인식: 8, 관계기술: 9, 책임감의사결정: 8 },
            interactions: [
                { period: '2교시', type: '발표', content: '수학 문제에 대해 정확하게 답변함', score: 2 },
                { period: '2교시', type: '협동/칭찬', content: '교사: 수학적 용어를 정확히 사용했어요', score: 2 }
            ]
        },
        '대성': {
            scores: { 발표: 1, 질문: 0, 협동칭찬: 0, 과제수행: 0, 갈등: 0, 장난산만: 3 },
            socialEmotional: { 자기인식: 5, 자기조절: 3, 사회적인식: 6, 관계기술: 4, 책임감의사결정: 5 },
            interactions: [
                { period: '1교시', type: '장난/산만', content: '수업 중 웃음소리를 내어 주의받음', score: -1 },
                { period: '2교시', type: '장난/산만', content: '빙글각이라고 장난치며 수업 방해', score: -1 }
            ]
        },
        '지수': {
            scores: { 발표: 2, 질문: 0, 협동칭찬: 2, 과제수행: 1, 갈등: 0, 장난산만: 0 },
            socialEmotional: { 자기인식: 7, 자기조절: 8, 사회적인식: 6, 관계기술: 8, 책임감의사결정: 7 },
            interactions: [
                { period: '1교시', type: '발표', content: '화장실 휴지 부족 문제를 용기있게 발표', score: 2 },
                { period: '1교시', type: '협동/칭찬', content: '교사: 조용한 친구의 말도 귀기울여 듣는 연습을', score: 2 }
            ]
        }
    };
    
    const result = {
        students: students,
        summary: originalText ? 
            `업로드된 텍스트 "${originalText.substring(0, 50)}..."를 바탕으로 분석한 결과, 준우와 영민 학생이 적극적으로 참여했으며, 대성 학생은 자기조절 능력 향상이 필요합니다.` :
            `오늘 수업에서 학생들이 전반적으로 잘 참여했습니다. 준우와 영민 학생이 특히 우수했고, 대성 학생은 약간의 지도가 필요합니다.`
    };
    
    console.log('✅ 목업 데이터 생성 완료');
    return result;
}

// API 엔드포인트들
app.get('/api/health', (req, res) => {
    console.log('🔍 헬스 체크 요청');
    res.json({ 
        status: 'OK', 
        openai: !!OPENAI_API_KEY,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version
    });
});

// 텍스트 분석 API (디버깅 모드)
app.post('/api/analyze-text', async (req, res) => {
    console.log('\n=== 텍스트 분석 API 호출 ===');
    console.log('📅 요청 시간:', new Date().toISOString());
    console.log('📝 요청 본문:', JSON.stringify(req.body, null, 2));
    
    try {
        const { text, date, className } = req.body;
        
        if (!text) {
            console.log('❌ 텍스트가 없음');
            return res.status(400).json({ error: '분석할 텍스트가 없습니다' });
        }
        
        console.log('📝 텍스트 길이:', text.length);
        console.log('📝 텍스트 미리보기:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        console.log('🔑 API 키 존재:', !!OPENAI_API_KEY);
        
        let analysis;
        let mode;
        
        if (!OPENAI_API_KEY) {
            console.log('🎭 API 키가 없어서 목업 모드로 실행');
            analysis = generateMockAnalysis(text);
            mode = 'mock';
        } else {
            console.log('🚀 실제 GPT API 호출 시작');
            try {
                analysis = await analyzeWithGPTDebug(text);
                mode = 'api';
                console.log('✅ GPT API 분석 성공');
            } catch (apiError) {
                console.error('⚠️ GPT API 실패, 목업으로 폴백:', apiError.message);
                analysis = generateMockAnalysis(text);
                mode = 'fallback';
            }
        }
        
        const response = {
            success: true,
            data: analysis,
            mode: mode,
            timestamp: new Date().toISOString()
        };
        
        console.log('📤 최종 응답:', JSON.stringify(response, null, 2));
        res.json(response);
        
    } catch (error) {
        console.error('❌ 텍스트 분석 전체 오류:', error);
        console.error('❌ 오류 스택:', error.stack);
        
        // 마지막 폴백: 목업 데이터라도 반환
        try {
            const fallbackData = generateMockAnalysis(req.body.text || '오류 발생');
            res.json({
                success: true,
                data: fallbackData,
                mode: 'error_fallback',
                error: error.message
            });
        } catch (fallbackError) {
            console.error('❌ 폴백마저 실패:', fallbackError);
            res.status(500).json({ 
                error: '분석 중 오류가 발생했습니다: ' + error.message,
                details: error.stack
            });
        }
    }
});

// 음성 파일 분석 API (디버깅 모드)
app.post('/api/analyze-audio', upload.single('audio'), async (req, res) => {
    console.log('\n=== 음성 분석 API 호출 ===');
    console.log('📅 요청 시간:', new Date().toISOString());
    
    try {
        const { date, className } = req.body;
        const audioFile = req.file;
        
        if (!audioFile) {
            console.log('❌ 오디오 파일이 없음');
            return res.status(400).json({ error: '오디오 파일이 없습니다' });
        }
        
        console.log('🎤 오디오 파일 정보:', {
            filename: audioFile.filename,
            originalname: audioFile.originalname,
            size: audioFile.size,
            mimetype: audioFile.mimetype
        });
        
        // 1. 음성을 텍스트로 변환
        console.log('🔄 Whisper API로 음성 변환 시작');
        const transcript = await transcribeAudioDebug(audioFile.path);
        
        // 2. 텍스트 분석
        console.log('🔄 GPT API로 텍스트 분석 시작');
        const analysis = await analyzeWithGPTDebug(transcript);
        
        const response = {
            success: true,
            data: analysis,
            transcript: transcript,
            audioInfo: {
                filename: audioFile.originalname,
                size: audioFile.size
            }
        };
        
        // 임시 파일 삭제
        fs.unlink(audioFile.path, (err) => {
            if (err) console.error('임시 파일 삭제 실패:', err);
            else console.log('✅ 임시 파일 삭제 완료');
        });
        
        console.log('📤 음성 분석 완료');
        res.json(response);
        
    } catch (error) {
        console.error('❌ 음성 분석 오류:', error);
        console.error('❌ 오류 스택:', error.stack);
        res.status(500).json({ error: '음성 분석 중 오류가 발생했습니다: ' + error.message });
    }
});

// 저장된 데이터 조회 API
app.get('/api/diary-data', (req, res) => {
    console.log('📋 저장된 데이터 조회 요청');
    // 실제 구현에서는 데이터베이스에서 조회
    res.json([]);
});

// 최신 데이터 조회 (목업)
app.get('/api/latest-diary', (req, res) => {
    console.log('📋 최신 데이터 조회 요청');
    const mockData = {
        id: 'demo',
        date: new Date().toISOString().split('T')[0],
        className: '4학년 1반',
        analysis: generateMockAnalysis(),
        originalText: '데모용 학급일지입니다. 텍스트를 입력하면 실제 AI 분석 결과가 표시됩니다.',
        createdAt: new Date()
    };
    res.json(mockData);
});

// 정적 파일 라우팅
app.get('/', (req, res) => {
    console.log('🏠 메인 페이지 요청');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 오류 처리 미들웨어
app.use((error, req, res, next) => {
    console.error('🚨 서버 오류:', error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
    console.log('\n🚀 =================================');
    console.log(`🚀 서버가 실행되었습니다: http://localhost:${PORT}`);
    console.log(`📊 OpenAI API: ${OPENAI_API_KEY ? '✅ 연결됨' : '❌ 연결 안됨 (목업 모드)'}`);
    console.log(`📁 정적 파일: public 폴더`);
    console.log(`🔍 디버그 모드: 활성화`);
    
    if (!OPENAI_API_KEY) {
        console.log(`💡 실제 AI 분석을 원하면 .env 파일에 OPENAI_API_KEY를 설정하세요`);
    }
    
    console.log('🚀 =================================\n');
});