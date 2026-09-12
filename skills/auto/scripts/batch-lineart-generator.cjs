const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = 'C:/Users/JW TSJ/.config/opencode/st1.credentials.json';
const BASE_DIR = 'C:/Users/JW TSJ/Desktop/完美分镜';
const API_URL = 'https://qwe.g-aisc.com/v1/images/generations';
const MODEL = 'gpt-image-2.5-sunburst';
const CONCURRENCY = 100;

function getApiKey() {
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    return creds.api_key || creds.apiKey || creds.token || creds['st1'];
}

function buildEnglishLineartPrompt(shot) {
    const singleFrameLock = "Strictly a SINGLE unified 16:9 widescreen full-frame cinematic camera shot, single camera view, single perspective. Strictly ONE single picture. Strictly ZERO comic panels, ZERO split screens, ZERO multi-grid layouts, ZERO borders, ZERO comic strips, ZERO multiple frames, ZERO speech bubbles, ZERO thought bubbles, ZERO collage.";
    const modernEraLock = "Time & Era: Modern contemporary China (2020s), authentic modern coastal realism. All characters: Strictly modern contemporary Chinese people, authentic modern neat short haircuts, modern casual everyday clothes (modern jackets, modern t-shirts, modern workwear, modern village casual wear, sneakers). Strictly ZERO ancient costumes, ZERO historical robes, ZERO topknots, ZERO hair buns, ZERO wuxia/hanfu elements.";
    const visualStyle = "Visual Style: Authentic Chinese contemporary coastal realism (中国当代沿海现实主义), gritty modern seafaring narrative drama, cinematic lens composition and physical perspective, minimalist 3D line-drawing pre-visualization single frame keyframe sketch, pure black vector line work on pure solid white background, zero shading, zero grayscale, zero fill colors, zero textures, crisp thin black outlines.";

    const isUnderwater = shot.shotType.includes('大俯角垂直向下俯视水面') || 
                          (shot.shotType.includes('水面') && (shot.charsRaw.includes('无') || !shot.charsRaw)) ||
                          shot.staging.includes('大俯角') || 
                          (shot.action.includes('海底') && (shot.charsRaw.includes('无') || !shot.charsRaw)) ||
                          shot.action.includes('数十米深的海底');

    if (isUnderwater) {
        return `${singleFrameLock} ${visualStyle} Camera view: Extreme high-angle top-down bird's eye view looking vertically straight down into transparent seawater (POV looking down at the seabed). Looking down through clear seawater at the seabed terrain: sandy seafloor, submerged rocks, reefs, and seaweed. Schools of marine fish swimming clustered in the seafloor sand. Strictly an underwater environment shot from vertical top-down perspective. Strictly ZERO sky, ZERO horizon, ZERO boats, ZERO human characters, ZERO figures. ${singleFrameLock}`;
    }

    // Determine character descriptions
    let charDesc = '';
    const isSpeedboat = shot.action.includes('快艇') || shot.staging.includes('快艇') || shot.sceneName.includes('快艇');
    const isRuinsLand = shot.sceneName.includes('废墟') || shot.staging.includes('废墟') || shot.action.includes('废墟');

    if (shot.charsRaw.includes('无') || !shot.charsRaw) {
        charDesc = `Empty scene environment: ${shot.sceneName}. Framing: ${shot.shotType}. Strictly ZERO human characters.`;
    } else {
        let envNote = 'standing in the scene.';
        if (isSpeedboat) {
            envNote = 'sitting in the modern driver cockpit of a 5-meter deep-V modern motor speedboat with sports steering wheel, dashboard, and curved windshield.';
        } else if (isRuinsLand) {
            envNote = 'standing firmly on the stone threshold and broken walls of the ruined courtyard house on the rocky shore, facing the ocean. Strictly on land, zero boats.';
        } else if (shot.sceneName.includes('船') || shot.sceneName.includes('海')) {
            envNote = 'on a modest small rustic wooden coastal boat on the sea.';
        }

        charDesc = `Characters: ${shot.charsRaw}. All characters are strictly modern contemporary Chinese people with modern short haircuts and modern clothes. Staging and relative positioning: ${shot.staging}. Keyframe decisive action: ${shot.action}. Strictly a single frozen keyframe moment in time, NOT a sequence.`;
    }

    return `${singleFrameLock} ${modernEraLock} ${visualStyle} Scene environment: ${shot.sceneName}. Shot framing: ${shot.shotType}. ${charDesc} Clear human figures with accurate physical proportions and perspective lines. ${singleFrameLock}`;
}

function parseEpisodeShots(epDir, epStr) {
    const shots = [];
    const segDirs = fs.readdirSync(epDir).filter(f => f.startsWith('SEG') && fs.statSync(path.join(epDir, f)).isDirectory());

    for (const seg of segDirs) {
        const segPath = path.join(epDir, seg);
        const promptFile = path.join(segPath, 'prompt.txt');
        if (!fs.existsSync(promptFile)) continue;

        let content = fs.readFileSync(promptFile, 'utf-8');
        content = content.replace(/\r\n/g, '\n');

        // Parse mixed mapping
        const mixedMap = {};
        for (const m of content.matchAll(/把\s*\{\{Mixed\s*\d+\}\}\s*中的人物[（(](.*?)[)）]作为主体(\d+)/g)) {
            mixedMap['主体' + m[2]] = m[1];
        }
        for (const m of content.matchAll(/把\s*\{\{Mixed\s*\d+\}\}\s*中的道具[（(](.*?)[)）]作为主体(\d+)/g)) {
            mixedMap['主体' + m[2]] = m[1];
        }
        for (const m of content.matchAll(/把\s*\{\{Mixed\s*\d+\}\}\s*中的场景[（(](.*?)[)）]作为主体(\d+)/g)) {
            mixedMap['主体' + m[2]] = m[1];
        }

        // Clean up orphaned lineart files in SEG folder
        const activeShotNums = [];
        const shotMatches = content.matchAll(/【镜头(\d+)】[（(](\d+)秒[)）]/g);
        for (const sm of shotMatches) {
            activeShotNums.push(parseInt(sm[1]));
        }

        const existingPngs = fs.readdirSync(segPath).filter(f => f.match(/^shot\d+_lineart\.png$/));
        for (const png of existingPngs) {
            const m = png.match(/^shot(\d+)_lineart\.png$/);
            if (m && !activeShotNums.includes(parseInt(m[1]))) {
                fs.unlinkSync(path.join(segPath, png));
                console.log(`[CLEANUP] Deleted orphaned file ${epStr}/${seg}/${png}`);
            }
        }

        // Scene name
        let sceneName = 'coastal scene';
        const sceneMatch = /把\s*\{\{(Mixed\s*\d+)\}\}\s*中的场景[（(](.*?)[)）]作为主体(\d+)/.exec(content);
        if (sceneMatch) {
            sceneName = sceneMatch[2];
        }

        const shotRegex = /【镜头(\d+)】[（(](\d+)秒[)）]([\s\S]*?)(?=【镜头\d+】|【结束状态】|$)/g;
        let m;
        while ((m = shotRegex.exec(content)) !== null) {
            const shotNum = parseInt(m[1]);
            const duration = parseInt(m[2]);
            const body = m[3];

            const charsMatch = /人物：(.*?)(?:\n|$)/.exec(body);
            let charsRaw = charsMatch ? charsMatch[1].trim() : '';

            const typeMatch = /景别\/拍摄\/运镜：(.*?)(?:\n|$)/.exec(body);
            let shotType = typeMatch ? typeMatch[1].trim() : 'medium shot';

            const posMatch = /位置承接：(.*?)(?:\n|$)/.exec(body);
            let staging = posMatch ? posMatch[1].trim() : '';
            staging = staging.replace(/\[线稿图对应关系.*?\]/g, '').trim();

            const actMatch = /动作\/表演：(.*?)(?:\n|$)/.exec(body);
            let action = actMatch ? actMatch[1].trim() : '';
            const seqMatch = /动作顺序：(.*?)(?:；动作后状态：|$)/.exec(action);
            if (seqMatch) {
                action = seqMatch[1].trim();
            }

            // Replace 主体X with resolved names
            for (const [k, v] of Object.entries(mixedMap)) {
                const re = new RegExp(k, 'g');
                charsRaw = charsRaw.replace(re, v);
                staging = staging.replace(re, v);
                action = action.replace(re, v);
            }

            shots.push({
                epName: epStr,
                segName: seg,
                shotNum,
                duration,
                sceneName,
                charsRaw,
                shotType,
                staging,
                action
            });
        }
    }
    return shots;
}

async function generateLineartWithRetry(task, apiKey, maxRetries = 3) {
    const epDir = path.join(BASE_DIR, task.epName);
    const segDir = path.join(epDir, task.segName);
    const targetFile = path.join(segDir, `shot${task.shotNum}_lineart.png`);
    const backupDir = path.join(epDir, '资产', '线稿');
    const backupFile = path.join(backupDir, `${task.segName}_shot${task.shotNum}_lineart.png`);

    const promptText = buildEnglishLineartPrompt(task);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: MODEL,
                    prompt: promptText,
                    size: '1792x1024',
                    response_format: 'b64_json'
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
            }

            const data = await res.json();
            const b64 = data.data?.[0]?.b64_json;
            if (!b64) throw new Error('No b64_json returned');

            const buffer = Buffer.from(b64, 'base64');
            fs.mkdirSync(segDir, { recursive: true });
            fs.writeFileSync(targetFile, buffer);

            fs.mkdirSync(backupDir, { recursive: true });
            fs.writeFileSync(backupFile, buffer);

            console.log(`[SUCCESS] ${task.epName} ${task.segName} shot${task.shotNum} (${buffer.length} bytes)`);
            return { task, success: true, size: buffer.length };
        } catch (err) {
            console.warn(`[RETRY ${attempt}/${maxRetries}] ${task.epName} ${task.segName} shot${task.shotNum}: ${err.message}`);
            if (attempt === maxRetries) {
                return { task, success: false, error: err.message };
            }
            await new Promise(r => setTimeout(r, 2000 * attempt));
        }
    }
}

async function main() {
    const apiKey = getApiKey();
    console.log(`[INFO] Loaded API Key for st1 (${apiKey.slice(0, 8)}...)`);

    const allTasks = [];
    for (let ep = 1; ep <= 20; ep++) {
        const epStr = `第${String(ep).padStart(3, '0')}集`;
        const epDir = path.join(BASE_DIR, epStr);
        if (!fs.existsSync(epDir)) continue;

        const shots = parseEpisodeShots(epDir, epStr);
        allTasks.push(...shots);
    }

    console.log(`[INFO] Collected ${allTasks.length} accurate shots across Batch 20.`);

    // Run with 100 concurrency
    let currentIndex = 0;
    let completedCount = 0;
    const failedTasks = [];

    async function worker(workerId) {
        while (currentIndex < allTasks.length) {
            const taskIndex = currentIndex++;
            const task = allTasks[taskIndex];
            const result = await generateLineartWithRetry(task, apiKey);
            completedCount++;
            if (!result.success) {
                failedTasks.push(result);
            }
            console.log(`[PROGRESS] ${completedCount}/${allTasks.length} completed (Worker ${workerId})`);
        }
    }

    const workers = [];
    const activeConcurrency = Math.min(CONCURRENCY, allTasks.length);
    console.log(`[INFO] Starting ${activeConcurrency} concurrent workers...`);

    for (let i = 0; i < activeConcurrency; i++) {
        workers.push(worker(i + 1));
    }

    await Promise.all(workers);

    console.log(`\n============================================================`);
    console.log(`RE-RENDER COMPLETE: ${completedCount - failedTasks.length}/${allTasks.length} succeeded!`);
    console.log(`Failed: ${failedTasks.length}`);
    console.log(`============================================================\n`);
}

if (require.main === module) {
    main().catch(console.error);
}
