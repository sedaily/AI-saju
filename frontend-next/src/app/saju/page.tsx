'use client';

import { useState } from 'react';
import { FortuneTab } from '@/features/fortune/components/FortuneTab';
import { FeatureTabs } from '@/widgets';

type MbtiGroup = 'NT' | 'NF' | 'ST' | 'SF';

export default function SajuStandalonePage() {
  const [mbtiGroup, setMbtiGroup] = useState<MbtiGroup>('NF');

  return (
    <main className="min-h-screen" style={{ background: '#F8F9FA' }}>
      <FeatureTabs />
      {/* FortuneTab 내부가 `-my-6` 으로 부모 padding 을 상쇄하는 구조라 py-6 으로 맞춰줌 */}
      <div className="py-6">
        <FortuneTab selectedGroup={mbtiGroup} onMbtiChange={setMbtiGroup} />
      </div>
    </main>
  );
}
