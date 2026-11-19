// 2. PROCEDURAL 16x16 PIXEL-ART TEXTURE ATLAS
// =========================================================================
function createTextureAtlas() {
    const tileSize = 16;
    const cols = 8;
    const rows = 7;
    const canvas = document.createElement('canvas');
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext('2d');

    const rand = (x, y, s) => {
        const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
        return n - Math.floor(n);
    };

    const drawTile = (idx, fn) => {
        const ox = (idx % cols) * tileSize;
        const oy = Math.floor(idx / cols) * tileSize;
        for (let y = 0; y < tileSize; y++) {
            for (let x = 0; x < tileSize; x++) {
                ctx.fillStyle = fn(x, y, rand(x, y, idx));
                ctx.fillRect(ox + x, oy + y, 1, 1);
            }
        }
    };

    drawTile(0, (x, y, r) => r > 0.65 ? '#22c55e' : (r > 0.3 ? '#4ade80' : '#16a34a'));
    drawTile(1, (x, y, r) => {
        const edge = 3 + Math.floor(rand(x, 0, 11) * 3);
        if (y < edge) return r > 0.4 ? '#4ade80' : '#22c55e';
        return r > 0.6 ? '#78350f' : (r > 0.25 ? '#92400e' : '#65320c');
    });
    drawTile(2, (x, y, r) => r > 0.65 ? '#78350f' : (r > 0.25 ? '#92400e' : '#5c2d0c'));
    drawTile(3, (x, y, r) => r > 0.7 ? '#94a3b8' : (r > 0.3 ? '#64748b' : '#475569'));
    drawTile(4, (x, y, r) => (x % 4 === 0 || r > 0.75) ? '#451a03' : '#78350f');
    drawTile(5, (x, y, r) => {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d > 6) return '#451a03';
        return Math.floor(d) % 2 === 0 ? '#d97706' : '#b45309';
    });
    drawTile(6, (x, y, r) => {
        if (y % 4 === 0 || (x === 7 && Math.floor(y / 4) % 2 === 0)) return '#92400e';
        return r > 0.5 ? '#d97706' : '#b45309';
    });
    drawTile(7, (x, y, r) => r > 0.55 ? '#16a34a' : (r > 0.2 ? '#22c55e' : '#15803d'));
    drawTile(8, (x, y, r) => r > 0.55 ? '#f9a8d4' : (r > 0.2 ? '#f472b6' : '#ec4899'));
    drawTile(9, (x, y, r) => r > 0.6 ? '#fef08a' : (r > 0.25 ? '#fde047' : '#eab308'));
    drawTile(10, (x, y, r) => (y % 4 === 0 && r > 0.4) ? '#7dd3fc' : '#0284c7');
    drawTile(11, (x, y, r) => ((x + y) % 5 === 0 || (x * 3 + y) % 7 === 0) ? '#334155' : (r > 0.45 ? '#94a3b8' : '#64748b'));
    drawTile(12, (x, y, r) => {
        if (x === 0 || y === 0 || x === 15 || y === 15) return '#e0f2fe';
        if ((x + y === 5 || x + y === 6) && x < 6) return '#ffffff';
        return 'rgba(186, 230, 253, 0.28)';
    });
    drawTile(13, (x, y, r) => {
        if (y < 4) return (x + y) % 2 === 0 ? '#78350f' : '#b45309';
        if (x === 0 || x === 15 || y === 15) return '#451a03';
        return r > 0.5 ? '#d97706' : '#92400e';
    });
    drawTile(14, (x, y, r) => r > 0.7 ? '#a16207' : (r > 0.3 ? '#ca8a04' : '#854d0e'));
    drawTile(15, (x, y, r) => {
        if (y <= 1 && x >= 6 && x <= 9) return '#94a3b8';
        if ((y === 2 || y === 3) && x >= 4 && x <= 11) return '#334155';
        if ((y === 13 || y === 14) && x >= 3 && x <= 12) return '#1e293b';
        if (y >= 4 && y <= 12 && (x === 3 || x === 12)) return '#1e293b';
        if (y >= 4 && y <= 12 && x >= 4 && x <= 11) {
            const d = Math.hypot(x - 7.5, y - 8);
            if (d < 2.4) return '#ffffff';
            if (d < 3.8) return '#fef08a';
            return '#f59e0b';
        }
        return 'rgba(0,0,0,0)';
    });
    drawTile(16, (x, y, r) => {
        if (x === 0 || y === 0 || x === 15 || y === 15) return '#ca8a04';
        return (x + y < 8 && r > 0.3) ? '#fef08a' : '#facc15';
    });
    drawTile(17, (x, y, r) => {
        if ((x > 3 && x < 12 && y > 3 && y < 12) && ((x + y) % 3 === 0 || r > 0.55)) {
            return r > 0.5 ? '#a5f3fc' : '#06b6d4';
        }
        return r > 0.5 ? '#475569' : '#334155';
    });
    drawTile(18, (x, y, r) => {
        if (y >= 5 && y <= 10) return '#f8fafc';
        return (x % 3 === 0) ? '#b91c1c' : '#ef4444';
    });
    drawTile(19, (x, y, r) => {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d < 2.2) return '#1e293b';
        return r > 0.4 ? '#ef4444' : '#dc2626';
    });
    drawTile(20, (x, y, r) => {
        if (x % 3 === 1 && y > 2) return y < 7 ? '#fef08a' : '#eab308';
        return 'rgba(0,0,0,0)';
    });
    drawTile(21, (x, y, r) => {
        if (x + y === 15 && x >= 4 && x <= 13) return '#ffffff';
        if (x + y === 14 && x >= 5 && x <= 13) return '#cbd5e1';
        if ((x === 3 && y === 10) || (x === 5 && y === 12) || (x === 4 && y === 11)) return '#f59e0b';
        if (x <= 3 && y >= 12 && x + y === 15) return '#78350f';
        return 'rgba(0,0,0,0)';
    });
    drawTile(22, (x, y, r) => {
        if ((y === 3 && x >= 4 && x <= 11) || (y === 4 && (x === 3 || x === 12)) || (y === 5 && (x === 2 || x === 13))) return '#ffffff';
        if (y === 4 && x >= 5 && x <= 10) return '#cbd5e1';
        if (x === 7 && y >= 4 && y <= 13) return '#92400e';
        return 'rgba(0,0,0,0)';
    });
    drawTile(23, (x, y, r) => {
        if ((x >= 8 && x <= 12 && y >= 3 && y <= 7) || (x === 7 && y >= 3 && y <= 5)) return y < 5 ? '#ffffff' : '#cbd5e1';
        if (x === 7 && y >= 4 && y <= 13) return '#92400e';
        return 'rgba(0,0,0,0)';
    });
    drawTile(24, (x, y, r) => {
        const wave = ((x * 5 + y * 3) % 7 === 0) || ((x * 2 - y * 5 + 16) % 6 === 0);
        if (wave && r > 0.35) return '#334155';
        if (r > 0.78) return '#1e1b4b';
        return r > 0.35 ? '#090d16' : '#020617';
    });
    drawTile(25, (x, y, r) => {
        if (y % 4 === 0 && r > 0.25) return '#0f172a';
        if (x % 6 === 0 && (y % 8 < 4) && r > 0.35) return '#1e293b';
        return r > 0.6 ? '#334155' : (r > 0.25 ? '#1e293b' : '#0f172a');
    });
    drawTile(26, (x, y, r) => {
        const vein = ((x >= 3 && x <= 6 && y >= 4 && y <= 6) || (x >= 9 && x <= 12 && y >= 9 && y <= 12) || (x >= 5 && x <= 8 && y >= 10 && y <= 12));
        if (vein && r > 0.22) return r > 0.6 ? '#fed7aa' : '#ea580c';
        return r > 0.55 ? '#334155' : '#1e293b';
    });
    drawTile(27, (x, y, r) => {
        const gem = ((x >= 4 && x <= 6 && y >= 4 && y <= 6) || (x >= 10 && x <= 12 && y >= 5 && y <= 7) || (x >= 6 && x <= 9 && y >= 10 && y <= 12));
        if (gem && r > 0.25) return r > 0.55 ? '#bae6fd' : '#0284c7';
        return r > 0.55 ? '#334155' : '#1e293b';
    });
    drawTile(28, (x, y, r) => {
        if (x + y === 15 && x >= 3 && x <= 12) return '#92400e';
        if (x + y === 14 && x >= 4 && x <= 12) return '#b45309';
        return 'rgba(0,0,0,0)';
    });
    drawTile(29, (x, y, r) => {
        if (x === 8 && y >= 2 && y <= 4) return '#78350f';
        if (x === 9 && y === 3) return '#22c55e';
        const d = Math.hypot(x - 7.5, y - 9);
        if (d < 4.5 && y >= 5 && y <= 13) return (x < 7 && y < 8) ? '#fca5a5' : (r > 0.4 ? '#ef4444' : '#dc2626');
        return 'rgba(0,0,0,0)';
    });
    drawTile(30, (x, y, r) => {
        if (y >= 6 && y <= 11 && x >= 2 && x <= 13) {
            if (y === 6 || y === 11 || x === 2 || x === 13) return '#78350f';
            return y < 8 ? '#fcd34d' : '#d97706';
        }
        return 'rgba(0,0,0,0)';
    });
    drawTile(31, (x, y, r) => (y % 4 === 1) ? '#451a03' : (r > 0.5 ? '#78350f' : '#5c2d0c'));
    drawTile(32, (x, y, r) => {
        const vein = ((x >= 3 && x <= 6 && y >= 4 && y <= 6) || (x >= 9 && x <= 12 && y >= 9 && y <= 12) || (x >= 5 && x <= 8 && y >= 10 && y <= 12));
        if (vein && r > 0.22) return r > 0.6 ? '#fed7aa' : '#ea580c';
        return r > 0.7 ? '#94a3b8' : (r > 0.3 ? '#64748b' : '#475569');
    });
    drawTile(33, (x, y, r) => {
        const gem = ((x >= 4 && x <= 6 && y >= 4 && y <= 6) || (x >= 10 && x <= 12 && y >= 5 && y <= 7) || (x >= 6 && x <= 9 && y >= 10 && y <= 12));
        if (gem && r > 0.25) return r > 0.55 ? '#bae6fd' : '#0284c7';
        return r > 0.7 ? '#94a3b8' : (r > 0.3 ? '#64748b' : '#475569');
    });
    drawTile(34, (x, y, r) => {
        if ((x > 3 && x < 12 && y > 3 && y < 12) && ((x + y) % 3 === 0 || r > 0.55)) {
            return r > 0.5 ? '#a5f3fc' : '#06b6d4';
        }
        return r > 0.6 ? '#334155' : (r > 0.25 ? '#1e293b' : '#0f172a');
    });
    drawTile(35, (x, y, r) => {
        if (x >= 6 && x <= 9 && y >= 2 && y <= 5) return x === 7 || y === 2 ? '#ffffff' : '#cbd5e1';
        if ((x === 7 || x === 8) && y >= 6 && y <= 13) return '#92400e';
        return 'rgba(0,0,0,0)';
    });
    drawTile(36, (x, y, r) => {
        if ((y === 3 && x >= 4 && x <= 10) || (y === 4 && x >= 4 && x <= 8)) return y === 3 ? '#ffffff' : '#cbd5e1';
        if (x === 8 && y >= 4 && y <= 13) return '#92400e';
        return 'rgba(0,0,0,0)';
    });
    drawTile(37, (x, y, r) => {
        if ((x * 3 + y * 5) % 7 === 0) return '#475569';
        return r > 0.65 ? '#94a3b8' : (r > 0.3 ? '#64748b' : '#475569');
    });
    drawTile(38, (x, y, r) => {
        const d = Math.hypot(x - 8, y - 8.5);
        if (d < 4.5 && x + y > 10 && x - y < 4) {
            return x < 8 ? '#475569' : '#0f172a';
        }
        return 'rgba(0,0,0,0)';
    });
    drawTile(39, (x, y, r) => {
        if ((x === 4 && y >= 4 && y <= 11) || ((y === 4 || y === 11) && x >= 4 && x <= 8)) return '#e2e8f0';
        if (x >= 9 && x <= 12 && y >= 6 && y <= 11) return r > 0.4 ? '#334155' : '#0f172a';
        if (x === 8 && y === 7) return '#fbbf24';
        return 'rgba(0,0,0,0)';
    });
    drawTile(40, (x, y, r) => {
        if ((x + y * 2) % 6 === 0 && r > 0.35) return '#4c1d95';
        if (r > 0.72) return '#312e81';
        return r > 0.3 ? '#1e1b4b' : '#090d16';
    });
    drawTile(41, (x, y, r) => {
        if ((x + y) % 5 === 0 && r > 0.45) return '#fef08a';
        return r > 0.55 ? '#fb923c' : (r > 0.2 ? '#ea580c' : '#dc2626');
    });
    drawTile(42, (x, y, r) => {
        if ((x * 2 + y * 3) % 6 === 0) return '#450a0a';
        return r > 0.65 ? '#b91c1c' : (r > 0.25 ? '#991b1b' : '#7f1d1d');
    });
    drawTile(43, (x, y, r) => {
        if (x === 0 || y === 0 || x === 15 || y === 15 || (x + y) % 5 === 0) return '#b45309';
        return r > 0.5 ? '#fef08a' : '#facc15';
    });
    drawTile(44, (x, y, r) => {
        if ((x === 5 || x === 10) && (y === 5 || y === 11)) return '#1c1917';
        return r > 0.55 ? '#57534e' : '#44403c';
    });
    drawTile(45, (x, y, r) => {
        const q = ((x >= 3 && x <= 6 && y >= 3 && y <= 5) || (x >= 9 && x <= 13 && y >= 8 && y <= 11));
        if (q && r > 0.2) return '#fff1f2';
        return r > 0.5 ? '#991b1b' : '#7f1d1d';
    });
    drawTile(46, (x, y, r) => {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (Math.floor(d) % 2 === 0) return r > 0.4 ? '#e879f9' : '#c026d3';
        return '#7e22ce';
    });
    drawTile(47, (x, y, r) => {
        const gem = ((x >= 3 && x <= 5 && y >= 3 && y <= 6) ||
            (x >= 10 && x <= 13 && y >= 4 && y <= 7) ||
            (x >= 5 && x <= 8 && y >= 10 && y <= 13) ||
            (x >= 11 && x <= 13 && y >= 11 && y <= 13));
        if (gem && r > 0.18) return r > 0.62 ? '#a7f3d0' : (r > 0.32 ? '#10b981' : '#047857');
        return r > 0.7 ? '#94a3b8' : (r > 0.3 ? '#64748b' : '#475569');
    });
    drawTile(48, (x, y, r) => {
        const dx = Math.abs(x - 7.5);
        const dy = Math.abs(y - 7.5);
        if (dx <= 4.5 && dy <= 5.5 && dx + dy <= 8.2) {
            if (dx > 3.2 || dy > 4.2 || dx + dy > 7) return '#065f46';
            if (x < 7 && y < 7) return '#a7f3d0';
            return r > 0.45 ? '#34d399' : '#10b981';
        }
        return 'rgba(0,0,0,0)';
    });
    drawTile(49, (x, y, r) => r > 0.75 ? '#e2e8f0' : (r > 0.35 ? '#f8fafc' : '#ffffff'));
    drawTile(50, (x, y, r) => {
        if ((x + y) % 6 === 0 && r > 0.28) return '#e0f2fe';
        return r > 0.55 ? '#7dd3fc' : (r > 0.25 ? '#38bdf8' : '#0284c7');
    });
    drawTile(51, (x, y, r) => {
        if (x === 0 || y === 0) return '#a7f3d0';
        if (x === 15 || y === 15) return '#065f46';
        if (x === 3 || y === 3 || x === 12 || y === 12) return '#34d399';
        return r > 0.5 ? '#10b981' : '#059669';
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.encoding = THREE.sRGBEncoding;
    return { tex, canvas, tileSize, cols, rows };
}

const tileDataURLCache = new Map();
function getTileDataURL(atlas, tileIdx, tint = null) {
    const cacheKey = tint ? `${tileIdx}:${tint[0]}:${tint[1]}` : `${tileIdx}`;
    if (tileDataURLCache.has(cacheKey)) return tileDataURLCache.get(cacheKey);
    const c = document.createElement('canvas');
    c.width = atlas.tileSize;
    c.height = atlas.tileSize;
    const ctx = c.getContext('2d');
    const ox = (tileIdx % atlas.cols) * atlas.tileSize;
    const oy = Math.floor(tileIdx / atlas.cols) * atlas.tileSize;
    ctx.drawImage(atlas.canvas, ox, oy, atlas.tileSize, atlas.tileSize, 0, 0, atlas.tileSize, atlas.tileSize);
    if (tint) {
        const imgData = ctx.getImageData(0, 0, atlas.tileSize, atlas.tileSize);
        const d = imgData.data;
        const parseHex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        const [r1, g1, b1] = parseHex(tint[0]);
        const [r2, g2, b2] = parseHex(tint[1]);
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) {
                d[i] = r1; d[i + 1] = g1; d[i + 2] = b1;
            } else if (d[i] > 180 && d[i + 1] > 195 && d[i + 2] > 210) {
                d[i] = r2; d[i + 1] = g2; d[i + 2] = b2;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
    const url = c.toDataURL();
    tileDataURLCache.set(cacheKey, url);
    return url;
}

function getItemIconURL(atlas, def) {
    if (!def || !def.tex) return null;
    const tileIdx = def.tex.all !== undefined ? def.tex.all : def.tex.side;
    return getTileDataURL(atlas, tileIdx, def.iconTint || null);
}

// =========================================================================
