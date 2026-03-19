import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  eyebrow: string;
  title: string;
  description: ReactNode;
};

const featureList: FeatureItem[] = [
  {
    eyebrow: 'Audience',
    title: 'Developer-Centered UX',
    description: (
      <>
        The portal is shifting away from infrastructure jargon toward an
        application-first experience that product teams can navigate without
        platform translation.
      </>
    ),
  },
  {
    eyebrow: 'Mental Model',
    title: 'Platform Abstractions',
    description: (
      <>
        The docs explain how the IDP turns Kubernetes and Crossplane building
        blocks into application environments, deployment workflows, and shared
        platform capabilities.
      </>
    ),
  },
  {
    eyebrow: 'Day 2 Operations',
    title: 'Operational Clarity',
    description: (
      <>
        Architecture, local development, and roadmap guidance are organized for
        engineers using the portal, not for maintaining a generic documentation
        template.
      </>
    ),
  },
];

function Feature({ eyebrow, title, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <article className={styles.featureCard}>
        <p className={styles.featureEyebrow}>{eyebrow}</p>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </article>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {featureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
