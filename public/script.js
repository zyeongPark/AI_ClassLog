
// 전역 변수
let currentAnalysisData = null;
let originalText = '';

// DOM 로딩 완료 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupFileUploadHandlers();
    setupPeriodTabs();
    loadLatestData();
}

// 파일 업로드 핸들러 설정
function setupFileUploadHandlers() {
    // 텍스트 파일 업로드
    document.getElementById('textFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type === 'text/plain') {
            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;
                document.getElementById('textInput').value = content;
                updateStatus('✅ 텍스트 파일이 로드되었습니다. "텍스트 AI 분석" 버튼을 클릭하세요.');
            };
            reader.readAsText(file, 'utf-8');
        } else {
            alert('텍스트 파일(.txt)만 업로드 가능합니다.');
        }
    });

    // 음성 파일 업로드
    document.getElementById('audioFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('audio/')) {
            analyzeAudioFile(file);
        } else {
            alert('음성 파일만 업로드 가능합니다.');
        }
    });
}

// 교시별 탭 설정
function setupPeriodTabs() {
    document.querySelectorAll('.period-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const period = this.dataset.period;
            filterByPeriod(period);
        });
    });
}

// 텍스트 분석 함수
async function analyzeText() {
    const text = document.getElementById('textInput').value.trim();
    
    if (!text) {
        alert('분석할 텍스트를 입력해주세요.');
        return;
    }
    
    showLoading(true);
    updateStatus('🤖 GPT가 텍스트를 분석하고 있습니다...');
    
    try {
        const response = await fetch('/api/analyze-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                date: new Date().toISOString().split('T')[0],
                className: '4학년 1반'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentAnalysisData = result.data;
            originalText = text;
            
            displayAnalysisResult(result.data);
            updateStatus('✅ AI 분석이 완료되었습니다! 학생 이름을 클릭하면 상세 분석을 볼 수 있습니다.');
        } else {
            throw new Error(result.error || '분석에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('텍스트 분석 오류:', error);
        updateStatus('❌ 분석 중 오류가 발생했습니다: ' + error.message);
        alert('분석 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    } finally {
        showLoading(false);
    }
}

// 음성 파일 분석 함수
async function analyzeAudioFile(file) {
    showLoading(true);
    updateStatus('🎤 음성을 텍스트로 변환하고 있습니다...');
    
    try {
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('date', new Date().toISOString().split('T')[0]);
        formData.append('className', '4학년 1반');
        
        const response = await fetch('/api/analyze-audio', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentAnalysisData = result.data;
            originalText = result.transcript;
            
            // 변환된 텍스트를 텍스트 입력창에도 표시
            document.getElementById('textInput').value = result.transcript;
            
            displayAnalysisResult(result.data);
            updateStatus('✅ 음성 분석이 완료되었습니다! 변환된 텍스트도 확인할 수 있습니다.');
        } else {
            throw new Error(result.error || '음성 분석에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('음성 분석 오류:', error);
        updateStatus('❌ 음성 분석 중 오류가 발생했습니다: ' + error.message);
        alert('음성 분석 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
    } finally {
        showLoading(false);
    }
}

// 분석 결과 표시 함수
function displayAnalysisResult(data) {
    displayStudentTable(data.students || {});
    displaySummary(data.summary || '분석 결과가 없습니다.');
    
    // 요약 섹션 표시
    document.getElementById('summarySection').style.display = 'block';
}

// 학생 테이블 표시
function displayStudentTable(students) {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';
    
    if (Object.keys(students).length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
                    분석된 학생 데이터가 없습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    Object.entries(students).forEach(([name, data]) => {
        const scores = data.scores || {};
        const totalScore = (scores.발표 || 0) + (scores.질문 || 0) + (scores.협동칭찬 || 0) + 
                          (scores.과제수행 || 0) - (scores.갈등 || 0) - (scores.장난산만 || 0);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="student-name" onclick="showStudentDetail('${name}')">${name}</td>
            <td class="score-positive">${scores.발표 || 0}</td>
            <td class="score-positive">${scores.질문 || 0}</td>
            <td class="score-positive">${scores.협동칭찬 || 0}</td>
            <td class="score-neutral">${scores.과제수행 || 0}</td>
            <td class="score-negative">${scores.갈등 || 0}</td>
            <td class="score-negative">${scores.장난산만 || 0}</td>
            <td class="score-${totalScore > 5 ? 'positive' : totalScore < 0 ? 'negative' : 'neutral'}">${totalScore}</td>
        `;
        tbody.appendChild(row);
    });
}

// 요약 표시
function displaySummary(summary) {
    document.getElementById('dailySummary').innerHTML = `
        <strong>📊 GPT AI 분석 요약</strong><br>
        ${summary}
    `;
}

// 학생 상세 정보 표시
function showStudentDetail(studentName) {
    if (!currentAnalysisData || !currentAnalysisData.students[studentName]) {
        alert('해당 학생의 데이터를 찾을 수 없습니다.');
        return;
    }
    
    const student = currentAnalysisData.students[studentName];
    
    // 모달 제목 설정
    document.getElementById('modalTitle').textContent = `${studentName} 학생 상세 분석`;
    
    // 사회정서역량 카드 업데이트
    updateCompetencyCards(student.socialEmotional || {});
    
    // 상호작용 내역 업데이트
    updateInteractionList(student.interactions || []);
    
    // 모달 표시
    document.getElementById('studentModal').classList.add('active');
}

// 사회정서역량 카드 업데이트
function updateCompetencyCards(socialEmotional) {
    const competencies = [
        { key: '자기인식', id: 'selfAwareness' },
        { key: '자기조절', id: 'selfRegulation' },
        { key: '사회적인식', id: 'socialAwareness' },
        { key: '관계기술', id: 'relationshipSkills' },
        { key: '책임감의사결정', id: 'responsibleDecision' }
    ];
    
    competencies.forEach(comp => {
        const score = socialEmotional[comp.key] || 0;
        const card = document.getElementById(comp.id);
        
        if (card) {
            const scoreElement = card.querySelector('.competency-score');
            if (scoreElement) {
                scoreElement.textContent = score;
            }
            
            // 점수에 따른 색상 적용
            card.classList.remove('high', 'medium', 'low');
            if (score >= 8) {
                card.classList.add('high');
            } else if (score >= 5) {
                card.classList.add('medium');
            } else {
                card.classList.add('low');
            }
        }
    });
}

// 상호작용 내역 업데이트
function updateInteractionList(interactions) {
    const container = document.getElementById('interactionList');
    container.innerHTML = '';
    
    if (interactions.length === 0) {
        container.innerHTML = `
            <div class="interaction-item">
                <div class="interaction-content">상호작용 내역이 없습니다.</div>
            </div>
        `;
        return;
    }
    
    interactions.forEach(interaction => {
        const item = document.createElement('div');
        item.className = 'interaction-item';
        
        const scoreClass = interaction.score > 0 ? 'score-positive-text' : 'score-negative-text';
        const scoreText = interaction.score > 0 ? '+' + interaction.score : interaction.score;
        
        item.innerHTML = `
            <div class="interaction-type">${interaction.period} - ${interaction.type}</div>
            <div class="interaction-content">${interaction.content}</div>
            <div class="interaction-score ${scoreClass}">${scoreText}점</div>
        `;
        
        container.appendChild(item);
    });
}

// 교시별 필터링
function filterByPeriod(period) {
    if (!currentAnalysisData) return;
    
    if (period === 'all') {
        displayAnalysisResult(currentAnalysisData);
    } else {
        const periodName = period + '교시';
        const periodContent = currentAnalysisData.periods && currentAnalysisData.periods[periodName];
        
        if (periodContent) {
            document.getElementById('dailySummary').innerHTML = `
                <strong>📊 ${periodName} 내용</strong><br>
                ${periodContent}
            `;
        } else {
            document.getElementById('dailySummary').innerHTML = `
                <strong>📊 ${periodName}</strong><br>
                해당 교시의 데이터가 없습니다.
            `;
        }
    }
}

// 원본 텍스트 표시
function showOriginalText() {
    const content = document.getElementById('originalContent');
    
    if (originalText) {
        content.innerHTML = `
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 3px solid #667eea;">
                <h4 style="margin-bottom: 10px; color: #667eea;">📄 원본 텍스트</h4>
                ${originalText.replace(/\n/g, '<br>')}
            </div>
        `;
        
        if (currentAnalysisData && currentAnalysisData.periods) {
            Object.entries(currentAnalysisData.periods).forEach(([period, content]) => {
                const periodDiv = document.createElement('div');
                periodDiv.style.cssText = 'background: white; padding: 15px; border-radius: 8px; border-left: 3px solid #38a169; margin-top: 15px;';
                periodDiv.innerHTML = `
                    <h4 style="margin-bottom: 10px; color: #38a169;">📚 ${period}</h4>
                    ${content}
                `;
                document.getElementById('originalContent').appendChild(periodDiv);
            });
        }
    } else {
        content.innerHTML = `
            <p style="color: #666; text-align: center; padding: 40px;">
                아직 분석된 텍스트가 없습니다.<br>
                텍스트를 입력하거나 파일을 업로드해주세요.
            </p>
        `;
    }
    
    document.getElementById('originalModal').classList.add('active');
}

// 최신 데이터 로드
async function loadLatestData() {
    try {
        const response = await fetch('/api/latest-diary');
        const data = await response.json();
        
        if (data && data.analysis) {
            currentAnalysisData = data.analysis;
            originalText = data.originalText || '기본 데모 데이터';
            displayAnalysisResult(data.analysis);
            updateStatus('📊 기존 분석 데이터를 불러왔습니다. 새로운 분석을 원하시면 텍스트를 입력해주세요.');
        }
    } catch (error) {
        console.error('데이터 로드 오류:', error);
        updateStatus('새로운 텍스트를 입력하거나 파일을 업로드해주세요.');
    }
}

// 유틸리티 함수들
function showLoading(show) {
    const loading = document.getElementById('loadingIndicator');
    if (show) {
        loading.classList.add('active');
    } else {
        loading.classList.remove('active');
    }
}

function updateStatus(message) {
    document.getElementById('analysisStatus').textContent = message;
}

function clearAll() {
    if (confirm('모든 데이터를 초기화하시겠습니까?')) {
        document.getElementById('textInput').value = '';
        document.getElementById('studentTableBody').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
                    텍스트를 입력하거나 파일을 업로드하면 AI 분석 결과가 표시됩니다
                </td>
            </tr>
        `;
        document.getElementById('summarySection').style.display = 'none';
        
        currentAnalysisData = null;
        originalText = '';
        
        updateStatus('🔄 초기화되었습니다. 새로운 텍스트를 입력해주세요.');
    }
}

// 모달 관련 함수들
function closeModal() {
    document.getElementById('studentModal').classList.remove('active');
}

function closeOriginalModal() {
    document.getElementById('originalModal').classList.remove('active');
}

// 모달 외부 클릭 시 닫기
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});