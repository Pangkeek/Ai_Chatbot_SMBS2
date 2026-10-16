import LineSimulatorIntro from './LineSimulatorIntro.jsx';
import LineSimulatorSetup from './LineSimulatorSetup.jsx';
import LineSimulatorChat from './LineSimulatorChat.jsx';

export default function LineSimulator() {
  return (
    <section className="border-t border-slate-200 pt-7" aria-labelledby="line-sim-title">
      <LineSimulatorIntro />
      <div className="grid grid-cols-1 items-start gap-6 min-[1151px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
        <LineSimulatorSetup />
        <LineSimulatorChat />
      </div>
    </section>
  );
}
