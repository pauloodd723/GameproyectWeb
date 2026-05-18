export default class LevelManager {
    constructor(experience) {
        this.experience = experience;
        this.currentLevel = 1;
        this.totalLevels = 5;

        this.pointsToComplete = {
            1: 2,
            2: 2,
            3: 4,
            4: 4,
            5: 4
        };

        this.spawnPoints = {
            1: { x: -17,  y: 1.5, z: -67  },
            2: { x: 0,    y: 1.5, z: -10  },
            3: { x: 0,    y: 1.5, z: 20   },
            4: { x: 0,    y: 1.5, z: 0    },
            5: { x: 0,    y: 1.5, z: 0    }
        };
    }

    nextLevel() {
        if (this.currentLevel < this.totalLevels) {
            this.currentLevel++;

            this.experience.world.clearCurrentScene();
            this.experience.world.loadLevel(this.currentLevel);

            setTimeout(() => {
                const spawn = this.spawnPoints[this.currentLevel] || { x: -17, y: 1.5, z: -67 }
                this.experience.world.resetRobotPosition(spawn)
            }, 1000)
        }
    }

    resetLevel() {
        this.currentLevel = 1;
        this.experience.world.loadLevel(this.currentLevel);
    }

    getCurrentLevelTargetPoints() {
        return this.pointsToComplete[this.currentLevel] || 2;
    }
}