import template from '@babel/template';

export const buildIfTemplate = template(`
    <template v-if="LOGICAL_LEFT">
        LOGICAL_RIGHT
    </template>
`);
