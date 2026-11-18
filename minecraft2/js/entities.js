// 4. ARTICULATED VOXEL MOBS & VILLAGERS
// =========================================================================
class MobEntity {
    constructor(scene, type, x, y, z, name = '') {
        this.scene = scene;
        this.type = type;
        this.name = name;
        this.pos = new THREE.Vector3(x, y, z);
        this.vel = new THREE.Vector3();
        this.yaw = Math.random() * Math.PI * 2;
        this.targetYaw = this.yaw;
        this.hp = type === 'zombie' ? 16 : (type === 'creeper' || type === 'skeleton' ? 14 : 10);
        this.maxHp = this.hp;
        this.hostile = type === 'zombie' || type === 'skeleton' || type === 'creeper';
        this.hurtTimer = 0;
        this.burnTimer = 0;
        this.aiTimer = Math.random() * 2;
        this.soundTimer = 2.0 + Math.random() * 6.0;
        this.attackCooldown = 0;
        this.fuseTimer = 0;
        this.hissPlayed = false;
        this.walkCycle = Math.random() * 6;

        this.group = new THREE.Group();
        this.parts = [];
        this.limbs = [];
        this.buildModel();
        this.group.position.copy(this.pos);
        this.scene.add(this.group);
    }

    addBox(parent, w, h, d, color, x, y, z, isLimb = false) {
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.userData.mob = this;
        parent.add(mesh);
        this.parts.push({ mesh, baseColor: new THREE.Color(color) });
        if (isLimb) this.limbs.push(mesh);
        return mesh;
    }

    buildModel() {
        const g = this.group;
        if (this.type === 'sheep') {
            this.addBox(g, 0.72, 0.65, 1.05, '#f8fafc', 0, 0.68, 0);
            this.addBox(g, 0.44, 0.44, 0.48, '#e2e8f0', 0, 0.85, 0.64);
            this.addBox(g, 0.34, 0.32, 0.25, '#cbd5e1', 0, 0.8, 0.88);
            this.addBox(g, 0.08, 0.08, 0.05, '#0f172a', -0.14, 0.88, 0.99);
            this.addBox(g, 0.08, 0.08, 0.05, '#0f172a', 0.14, 0.88, 0.99);
            [[-0.22, -0.32], [0.22, -0.32], [-0.22, 0.32], [0.22, 0.32]].forEach(([lx, lz]) => {
                this.addBox(g, 0.16, 0.42, 0.16, '#94a3b8', lx, 0.21, lz, true);
            });
        } else if (this.type === 'cow') {
            this.addBox(g, 0.78, 0.72, 1.15, '#78350f', 0, 0.74, 0);
            this.addBox(g, 0.8, 0.36, 0.45, '#f8fafc', 0, 0.86, 0.1);
            this.addBox(g, 0.48, 0.48, 0.46, '#78350f', 0, 0.92, 0.7);
            this.addBox(g, 0.38, 0.24, 0.16, '#fbcfe8', 0, 0.8, 0.96);
            this.addBox(g, 0.08, 0.16, 0.08, '#e2e8f0', -0.26, 1.18, 0.68);
            this.addBox(g, 0.08, 0.16, 0.08, '#e2e8f0', 0.26, 1.18, 0.68);
            this.addBox(g, 0.08, 0.08, 0.05, '#0f172a', -0.16, 0.98, 0.94);
            this.addBox(g, 0.08, 0.08, 0.05, '#0f172a', 0.16, 0.98, 0.94);
            [[-0.24, -0.36], [0.24, -0.36], [-0.24, 0.36], [0.24, 0.36]].forEach(([lx, lz]) => {
                this.addBox(g, 0.18, 0.44, 0.18, '#451a03', lx, 0.22, lz, true);
            });
        } else if (this.type === 'fox') {
            this.addBox(g, 0.46, 0.4, 0.78, '#ea580c', 0, 0.45, 0);
            this.addBox(g, 0.42, 0.36, 0.42, '#ea580c', 0, 0.56, 0.52);
            this.addBox(g, 0.22, 0.16, 0.24, '#f8fafc', 0, 0.48, 0.8);
            this.addBox(g, 0.08, 0.08, 0.06, '#0f172a', 0, 0.52, 0.93);
            this.addBox(g, 0.12, 0.16, 0.08, '#451a03', -0.14, 0.8, 0.48);
            this.addBox(g, 0.12, 0.16, 0.08, '#451a03', 0.14, 0.8, 0.48);
            this.addBox(g, 0.24, 0.24, 0.55, '#ea580c', 0, 0.46, -0.62);
            this.addBox(g, 0.25, 0.25, 0.2, '#f8fafc', 0, 0.46, -0.92);
            [[-0.14, -0.24], [0.14, -0.24], [-0.14, 0.24], [0.14, 0.24]].forEach(([lx, lz]) => {
                this.addBox(g, 0.12, 0.28, 0.12, '#1e293b', lx, 0.14, lz, true);
            });
        } else if (this.type === 'villager') {
            this.addBox(g, 0.56, 0.96, 0.38, '#78350f', 0, 0.78, 0);
            this.addBox(g, 0.58, 0.25, 0.4, '#10b981', 0, 0.88, 0);
            this.addBox(g, 0.46, 0.52, 0.46, '#eab676', 0, 1.54, 0);
            this.addBox(g, 0.12, 0.2, 0.14, '#d99b52', 0, 1.44, 0.27);
            this.addBox(g, 0.36, 0.07, 0.06, '#451a03', 0, 1.63, 0.24);
            this.addBox(g, 0.08, 0.08, 0.05, '#15803d', -0.12, 1.56, 0.24);
            this.addBox(g, 0.08, 0.08, 0.05, '#15803d', 0.12, 1.56, 0.24);
            this.addBox(g, 0.68, 0.24, 0.26, '#92400e', 0, 0.96, 0.22);
            this.addBox(g, 0.22, 0.32, 0.24, '#451a03', -0.14, 0.16, 0, true);
            this.addBox(g, 0.22, 0.32, 0.24, '#451a03', 0.14, 0.16, 0, true);
        } else if (this.type === 'zombie') {
            this.addBox(g, 0.54, 0.74, 0.3, '#0284c7', 0, 1.06, 0);
            this.addBox(g, 0.48, 0.48, 0.48, '#22c55e', 0, 1.68, 0);
            this.addBox(g, 0.1, 0.07, 0.05, '#0f172a', -0.12, 1.68, 0.25);
            this.addBox(g, 0.1, 0.07, 0.05, '#0f172a', 0.12, 1.68, 0.25);
            this.addBox(g, 0.2, 0.2, 0.68, '#16a34a', -0.38, 1.24, 0.28);
            this.addBox(g, 0.2, 0.2, 0.68, '#16a34a', 0.38, 1.24, 0.28);
            this.addBox(g, 0.22, 0.68, 0.24, '#3730a3', -0.14, 0.34, 0, true);
            this.addBox(g, 0.22, 0.68, 0.24, '#3730a3', 0.14, 0.34, 0, true);
        } else if (this.type === 'skeleton') {
            this.addBox(g, 0.46, 0.72, 0.24, '#e2e8f0', 0, 1.06, 0);
            this.addBox(g, 0.46, 0.46, 0.46, '#f8fafc', 0, 1.66, 0);
            this.addBox(g, 0.1, 0.1, 0.05, '#0f172a', -0.12, 1.66, 0.24);
            this.addBox(g, 0.1, 0.1, 0.05, '#0f172a', 0.12, 1.66, 0.24);
            this.addBox(g, 0.14, 0.14, 0.64, '#cbd5e1', -0.32, 1.22, 0.24);
            this.addBox(g, 0.14, 0.14, 0.64, '#cbd5e1', 0.32, 1.22, 0.24);
            this.addBox(g, 0.08, 0.65, 0.12, '#78350f', 0.34, 1.22, 0.56);
            this.addBox(g, 0.14, 0.68, 0.14, '#cbd5e1', -0.14, 0.34, 0, true);
            this.addBox(g, 0.14, 0.68, 0.14, '#cbd5e1', 0.14, 0.34, 0, true);
        } else if (this.type === 'creeper') {
            this.addBox(g, 0.52, 0.92, 0.34, '#16a34a', 0, 0.86, 0);
            this.addBox(g, 0.5, 0.5, 0.5, '#22c55e', 0, 1.56, 0);
            this.addBox(g, 0.11, 0.11, 0.05, '#0f172a', -0.13, 1.62, 0.26);
            this.addBox(g, 0.11, 0.11, 0.05, '#0f172a', 0.13, 1.62, 0.26);
            this.addBox(g, 0.18, 0.14, 0.05, '#0f172a', 0, 1.48, 0.26);
            this.addBox(g, 0.24, 0.08, 0.05, '#0f172a', 0, 1.41, 0.26);
            [[-0.16, -0.2], [0.16, -0.2], [-0.16, 0.2], [0.16, 0.2]].forEach(([lx, lz]) => {
                this.addBox(g, 0.2, 0.4, 0.2, '#15803d', lx, 0.2, lz, true);
            });
        }
    }

    destroy() {
        this.scene.remove(this.group);
        this.parts.forEach(p => {
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        });
    }
}

// =========================================================================
