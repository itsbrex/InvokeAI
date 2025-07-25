import { Flex, Icon, Text, Tooltip } from '@invoke-ai/ui-library';
import { compare } from 'compare-versions';
import { useInvocationNodeNotes } from 'features/nodes/hooks/useNodeNotes';
import { useNodeTemplateOrThrow } from 'features/nodes/hooks/useNodeTemplateOrThrow';
import { useNodeUserTitleSafe } from 'features/nodes/hooks/useNodeUserTitleSafe';
import { useNodeVersion } from 'features/nodes/hooks/useNodeVersion';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiInfoBold } from 'react-icons/pi';

interface Props {
  nodeId: string;
}

export const InvocationNodeInfoIcon = memo(({ nodeId }: Props) => {
  return (
    <Tooltip label={<TooltipContent nodeId={nodeId} />} placement="top" shouldWrapChildren>
      <Icon as={PiInfoBold} display="block" boxSize={4} w={8} />
    </Tooltip>
  );
});

InvocationNodeInfoIcon.displayName = 'InvocationNodeInfoIcon';

const TooltipContent = memo((_: { nodeId: string }) => {
  const notes = useInvocationNodeNotes();
  const label = useNodeUserTitleSafe();
  const version = useNodeVersion();
  const nodeTemplate = useNodeTemplateOrThrow();
  const { t } = useTranslation();

  const title = useMemo(() => {
    if (label) {
      return `${label} (${nodeTemplate.title})`;
    }

    return nodeTemplate.title;
  }, [label, nodeTemplate.title]);

  return (
    <Flex flexDir="column">
      <Text as="span" fontWeight="semibold">
        {title}
      </Text>
      <Text opacity={0.7}>
        {t('nodes.nodePack')}: {nodeTemplate.nodePack}
      </Text>
      <Text opacity={0.7} fontStyle="oblique 5deg">
        {nodeTemplate.description}
      </Text>
      <Version nodeVersion={version} templateVersion={nodeTemplate.version} />
      {notes && <Text>{notes}</Text>}
    </Flex>
  );
});

TooltipContent.displayName = 'TooltipContent';

const Version = ({ nodeVersion, templateVersion }: { nodeVersion: string; templateVersion: string }) => {
  const { t } = useTranslation();

  if (compare(nodeVersion, templateVersion, '<')) {
    return (
      <Text as="span" color="error.500">
        {t('nodes.version')} {nodeVersion} ({t('nodes.updateNode')})
      </Text>
    );
  }

  if (compare(nodeVersion, templateVersion, '>')) {
    return (
      <Text as="span" color="error.500">
        {t('nodes.version')} {nodeVersion} ({t('nodes.updateApp')})
      </Text>
    );
  }

  return (
    <Text as="span">
      {t('nodes.version')} {nodeVersion}
    </Text>
  );
};
