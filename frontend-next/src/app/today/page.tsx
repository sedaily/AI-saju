'use client';

import { useState } from 'react';
import { FortuneTab } from '@/features/fortune/components/FortuneTab';
import { FeatureTabs } from '@/widgets';

type MbtiGroup = 'NT' | 'NF' | 'ST' | 'SF';

export default function TodayPage() {
  const [mbtiGroup, setMbtiGroup] = useState<MbtiGroup>('NF');

  return (
    <main className="min-h-screen" style={{ background: '#F8F9FA' }}>
      <FeatureTabs />
      <div className="py-6">
        <FortuneTab selectedGroup={mbtiGroup} onMbtiChange={setMbtiGroup} mode="today" />
      </div>
    </main>
  );
}
