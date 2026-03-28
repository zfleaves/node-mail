/**
 * 表单解决方案 - 基于 Formily
 */

export { createForm } from '@formily/core'
export { FormProvider, FormConsumer, Field } from '@formily/vue'

/**
 * 创建通用表单配置
 */
export function createFormSchema(fields: any[]) {
  return {
    type: 'object',
    properties: fields.reduce((acc, field) => {
      acc[field.name] = field
      return acc
    }, {} as Record<string, any>)
  }
}

/**
 * 常用表单字段类型
 */
export const FieldTypes = {
  INPUT: 'Input',
  NUMBER: 'NumberPicker',
  SELECT: 'Select',
  DATE: 'DatePicker',
  CHECKBOX: 'Checkbox',
  RADIO: 'Radio',
  TEXTAREA: 'Input.TextArea'
} as const