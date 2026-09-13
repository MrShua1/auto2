const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = 'C:/Users/JW TSJ/.config/opencode/st1.credentials.json';
const DEFAULT_DELIVER_DIR = 'C:/Users/JW TSJ/Desktop/水眼金睛-Auto-Batch20黄金分镜交付';
const BASE_DIR = fs.existsSync(DEFAULT_DELIVER_DIR) ? DEFAULT_DELIVER_DIR : 'C:/Users/JW TSJ/Desktop/完美分镜';
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
    const facelessMannequinLock = "Rule L-05 Faceless Mannequin Lock: All human characters are strictly rendered as featureless 3D artist mannequins and smooth blank wooden pose dummies. Smooth blank egg-shaped oval heads with completely ZERO facial features (strictly zero eyes, zero pupils, zero eyebrows, zero nose, zero mouth, zero lips, zero teeth, zero facial expression, zero realistic face, zero detailed portrait, zero facial identity). ONLY a single subtle faint 3D crosshair line across the blank oval head to strictly indicate face orientation, gaze direction, and head tilt. Body, limbs, and clothing are simplified minimalist geometric contour outlines establishing physical staging, body blocking, posture, and spatial perspective ONLY.";

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

    // Rule 0.31: Framing Normalizer for Storyboard Lineart
    // White-sketch storyboard lineart functions strictly as a spatial staging, orientation, and postural blueprint.
    // It must NEVER serve as a facial portrait or extreme close-up headshot!
    let lineartFraming = '';
    if (shot.charsRaw.includes('无') || !shot.charsRaw) {
        lineartFraming = `Shot framing: Environmental shot (${shot.shotType}).`;
        charDesc = `Empty scene environment: ${shot.sceneName}. ${lineartFraming} Strictly ZERO human characters.`;
    } else {
        lineartFraming = `Shot framing: Medium shot (waist-up mid-shot) or Full shot (wide view) establishing character spatial staging, physical placement, and body orientation in the environment. Strictly ZERO extreme close-up, ZERO facial portrait, ZERO headshot, ZERO tight cropping. Full torso, arms, hands, legs, and body orientation clearly visible in relation to the environment and props.`;
        let envNote = 'standing in the scene.';
        if (isSpeedboat) {
            envNote = 'sitting in the modern driver cockpit of a 5-meter deep-V modern motor speedboat with sports steering wheel, dashboard, and curved windshield.';
        } else if (isRuinsLand) {
            envNote = 'standing firmly on the stone threshold and broken walls of the ruined courtyard house on the rocky shore, facing the ocean. Strictly on land, zero boats.';
        } else if (shot.sceneName.includes('船') || shot.sceneName.includes('海')) {
            envNote = 'sitting or standing on a modest small rustic wooden coastal boat on the sea.';
        }

        // Rule L-06: Character Count & Anti-Duplication Lock
        let countLock = '';
        const rawTrim = shot.charsRaw.replace(/主体\d+/g, '').trim();
        const splitChars = shot.charsRaw.split(/[,，、与和及\+]/).map(s => s.trim()).filter(Boolean);
        const charCount = splitChars.length;

        if (charCount === 1) {
            countLock = "Rule L-06 Exact Character Count Lock: Strictly EXACTLY ONE single solitary person in the entire image. Strictly ZERO other people, ZERO second character, ZERO additional fishermen, ZERO crew members, ZERO onlookers, ZERO duplicate figures representing sequential actions. One solitary person ALONE in the scene. Strictly a single frozen decisive keyframe pose, ZERO action sequence clones.";
        } else if (charCount === 2) {
            countLock = "Rule L-06 Exact Character Count Lock: Strictly EXACTLY TWO people in the entire image. Strictly ZERO third person, ZERO extra bystanders, ZERO onlookers, ZERO duplicate figures representing sequential actions. Exactly two solitary figures interacting.";
        } else if (charCount === 3) {
            countLock = "Rule L-06 Exact Character Count Lock: Strictly EXACTLY THREE people in the entire image. Strictly ZERO fourth person, ZERO extra onlookers, ZERO duplicate figures representing sequential actions.";
        } else if (charCount > 3) {
            countLock = `Rule L-06 Exact Character Count Lock: Strictly EXACTLY ${charCount} people in the entire image. Strictly ZERO extra onlookers, ZERO duplicate figures.`;
        }

        // Sanitize sensitive medical/gore terms for lineart mannequins
        let cleanStaging = (shot.staging || '')
            .replace(/烧伤[创处口面]?|创面|伤口|溃烂|血痂|暗红色|皮肉蠕动|切片/g, '皮肤')
            .replace(/burn|wound|injury|blood|flesh|scab/gi, 'skin');
        let cleanAction = (shot.action || '')
            .replace(/烧伤[创处口面]?|创面|伤口|溃烂|血痂|暗红色|皮肉蠕动|切片/g, '皮肤')
            .replace(/burn|wound|injury|blood|flesh|scab/gi, 'skin');

        charDesc = `Characters: ${shot.charsRaw}. All characters are strictly modern contemporary Chinese people with modern short haircuts and modern clothes, rendered as faceless 3D mannequins with blank smooth heads and zero facial features. ${countLock} Staging and relative positioning: ${cleanStaging}. Keyframe decisive action: ${cleanAction}. Strictly a single frozen keyframe moment in time, NOT a sequence.`;
    }

    return `${singleFrameLock} ${modernEraLock} ${visualStyle} ${facelessMannequinLock} Scene environment: ${shot.sceneName}. ${lineartFraming} ${charDesc} Clear human mannequin figures with accurate physical proportions, posture, and perspective lines. Strictly ZERO facial features. ${singleFrameLock}`;
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
        const shotMatches = content.matchAll(/【镜头(\d+)】[（(]([\d\.]+)秒[)）]/g);
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

        const shotRegex = /【镜头(\d+)】[（(]([\d\.]+)秒[)）]([\s\S]*?)(?=【镜头\d+】|【结束状态】|$)/g;
        let m;
        while ((m = shotRegex.exec(content)) !== null) {
            const shotNum = parseInt(m[1]);
            const duration = parseFloat(m[2]);
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
                epDir,
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
    const epDir = task.epDir || path.join(task.baseDir || BASE_DIR, task.epName);
    const segDir = path.join(epDir, task.segName);
    const targetFile = path.join(segDir, `shot${task.shotNum}_lineart.png`);
    const backupDir = path.join(epDir, '资产', '线稿');
    const backupFile = path.join(backupDir, `${task.segName}_shot${task.shotNum}_lineart.png`);

    if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 10240 && !process.argv.includes('--force')) {
        if (!fs.existsSync(backupFile)) {
            fs.mkdirSync(backupDir, { recursive: true });
            fs.copyFileSync(targetFile, backupFile);
        }
        console.log(`[SKIP] Already exists: ${task.epName} ${task.segName} shot${task.shotNum}`);
        return { task, success: true, size: fs.statSync(targetFile).size };
    }

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

    const args = process.argv.slice(2);
    let targetEp = null;
    let startEp = null;
    let endEp = null;
    let onlyCloseups = false;
    let baseDir = BASE_DIR;
    let maxConcurrency = CONCURRENCY;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--ep' && args[i + 1]) {
            targetEp = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--start-ep' && args[i + 1]) {
            startEp = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--end-ep' && args[i + 1]) {
            endEp = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--concurrency' && args[i + 1]) {
            maxConcurrency = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--base-dir' && args[i + 1]) {
            baseDir = args[i + 1];
            i++;
        } else if (args[i] === '--only-closeups') {
            onlyCloseups = true;
        }
    }

    const allTasks = [];
    const minEp = startEp || (targetEp || 1);
    const maxEp = endEp || (targetEp || 20);

    for (let ep = minEp; ep <= maxEp; ep++) {
        if (targetEp && ep !== targetEp) continue;
        const epStr = `第${String(ep).padStart(3, '0')}集`;
        const epDir = path.join(baseDir, epStr);
        if (!fs.existsSync(epDir)) continue;

        let shots = parseEpisodeShots(epDir, epStr);
        if (onlyCloseups) {
            shots = shots.filter(s => {
                const isChar = !s.charsRaw.includes('无') && s.charsRaw !== '';
                const isClose = s.shotType.includes('特写') || s.shotType.includes('面部') || s.shotType.includes('近景');
                return isChar && isClose;
            });
        }
        allTasks.push(...shots);
    }

    console.log(`[INFO] Collected ${allTasks.length} accurate shots (ep: ${minEp}..${maxEp}, onlyCloseups=${onlyCloseups}).`);

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
    const activeConcurrency = Math.min(maxConcurrency, allTasks.length);
    console.log(`[INFO] Starting ${activeConcurrency} concurrent workers (limit: ${maxConcurrency})...`);

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
