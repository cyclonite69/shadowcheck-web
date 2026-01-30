interface LockStatus {
  locked: boolean;
  lockedAt: string | null;
}

/**
 * Simple in-memory lock to prevent concurrent ML training runs.
 * Note: For multi-instance deployments, replace with a shared lock (e.g., Redis).
 */
class MLTrainingLock {
  private locked: boolean = false;
  private lockedAt: string | null = null;

  /**
   * Acquire the training lock.
   */
  acquire(): boolean {
    if (this.locked) {
      return false;
    }
    this.locked = true;
    this.lockedAt = new Date().toISOString();
    return true;
  }

  /**
   * Release the training lock.
   */
  release(): void {
    this.locked = false;
    this.lockedAt = null;
  }

  /**
   * Returns current lock status.
   */
  status(): LockStatus {
    return { locked: this.locked, lockedAt: this.lockedAt };
  }
}

export default new MLTrainingLock();
