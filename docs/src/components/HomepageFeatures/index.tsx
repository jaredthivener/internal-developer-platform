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
    eyebrow: 'Application teams',
    title: 'Docs that speak the product language',
    description: (
      <>
        The documentation matches the console vocabulary: applications,
        environments, and operational workflows instead of raw infrastructure
        internals.
      </>
    ),
  },
  {
    eyebrow: 'Platform model',
    title: 'Crossplane details translated into intent',
    description: (
      <>
        The site frames Kubernetes and Crossplane as platform implementation
        details behind a cleaner application-environment mental model.
      </>
    ),
  },
  {
    eyebrow: 'Operations',
    title: 'Reference material organized like a console',
    description: (
      <>
        Architecture, local development, and roadmap content now sit inside a
        visual system that feels consistent with the main IDP experience.
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
