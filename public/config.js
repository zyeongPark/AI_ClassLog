// 텍스트 분석 API (디버깅 모드)
app.post('/api/analyze-text', async (req, res) => {
    try {
        const { text, date, className } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: '분석할 텍스트가 없습니다' });
        }
        
        console.log('=== 디버깅 시작 ===');
        console.log('📝 텍스트 길이:', text.length);
        console.log('🔑 API 키 존재:', !!OPENAI_API_KEY);
        console.log('🔑 API 키 시작:', OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'null');
        
        // API 키 체크
        if (!OPENAI_API_KEY) {
            console.log('⚠️ API 키가 없어서 목업 데이터 반환');
            const mockData = generateMockAnalysis(text);
            return res.json({
                success: true,
                data: mockData,
                mode: 'mock'
            });
        }
        
        console.log('🚀 GPT API 호출 시작');
        const analysis = await analyzeWithGPTDebug(text);
        
        console.log('✅ 분석 완료');
        res.json({
            success: true,
            data: analysis,
            mode: 'api'
        });
        
    } catch (error) {
        console.error('❌ 텍스트 분석 오류:', error);
        console.error('❌ 오류 스택:', error.stack);
        
        // 오류가 발생해도 목업 데이터로 응답
        const mockData = generateMockAnalysis(text);
        res.json({
            success: true,
            data: mockData,
            mode: 'fallback',
            error: error.message
        });
    }
});

// 디버깅용 GPT 함수
async function analyzeWithGPTDebug(text) {
    try {
        const prompt = `다음 수업 내용을 분석해서 JSON으로만 응답해주세요:

{
  "students": {
    "학생이름": {
      "scores": {"발표": 숫자, "질문": 숫자, "협동칭찬": 숫자, "과제수행": 숫자, "갈등": 숫자, "장난산만": 숫자},
      "socialEmotional": {"자기인식": 숫자, "자기조절": 숫자, "사회적인식": 숫자, "관계기술": 숫자, "책임감의사결정": 숫자},
      "interactions": [{"period": "1교시", "type": "발표", "content": "내용", "score": 2}]
    }
  },
  "summary": "전체 요약"
}

텍스트: ${text}`;

        console.log('📤 OpenAI API 요청 준비');
        
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: '당신은 학급일지 분석 AI입니다. 반드시 JSON 형태로만 응답하세요.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1500,
                temperature: 0.3
            })
        });

        console.log('📥 OpenAI API 응답 상태:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ OpenAI API 오류 응답:', errorText);
            throw new Error(`OpenAI API 오류: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📊 OpenAI 응답 데이터:', JSON.stringify(data, null, 2));
        
        const content = data.choices[0].message.content;
        console.log('📝 GPT 생성 내용:', content);
        
        // JSON 추출 시도
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            console.log('✅ JSON 파싱 성공');
            return result;
        } else {
            console.error('❌ JSON 형태를 찾을 수 없음');
            throw new Error('GPT가 JSON 형태로 응답하지 않았습니다');
        }
        
    } catch (error) {
        console.error('❌ GPT 분석 중 오류:', error);
        throw error;
    }
}주