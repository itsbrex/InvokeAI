import type { ChakraProps } from '@invoke-ai/ui-library';
import { Flex, FormControlGroup } from '@invoke-ai/ui-library';
import { useIsExecutableNode } from 'features/nodes/hooks/useIsBatchNode';
import { useNodeHasImageOutput } from 'features/nodes/hooks/useNodeHasImageOutput';
import { DRAG_HANDLE_CLASSNAME } from 'features/nodes/types/constants';
import { useFeatureStatus } from 'features/system/hooks/useFeatureStatus';
import { memo } from 'react';

import SaveToGalleryCheckbox from './SaveToGalleryCheckbox';
import UseCacheCheckbox from './UseCacheCheckbox';

type Props = {
  nodeId: string;
};

const props: ChakraProps = { w: 'unset' };

const InvocationNodeFooter = ({ nodeId }: Props) => {
  const hasImageOutput = useNodeHasImageOutput();
  const isExecutableNode = useIsExecutableNode();
  const isCacheEnabled = useFeatureStatus('invocationCache');
  return (
    <Flex
      className={DRAG_HANDLE_CLASSNAME}
      layerStyle="nodeFooter"
      w="full"
      borderBottomRadius="base"
      gap={4}
      px={2}
      py={0}
      h={8}
      justifyContent="space-between"
    >
      <FormControlGroup formControlProps={props} formLabelProps={props}>
        {isExecutableNode && isCacheEnabled && <UseCacheCheckbox nodeId={nodeId} />}
        {isExecutableNode && hasImageOutput && <SaveToGalleryCheckbox nodeId={nodeId} />}
      </FormControlGroup>
    </Flex>
  );
};

export default memo(InvocationNodeFooter);
